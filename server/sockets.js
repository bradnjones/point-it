import {
  closeSession,
  getSessionByCode,
  getSessionById,
  setActiveStory,
  verifyFacilitatorToken,
} from './services/sessions.js';
import { getParticipant, listParticipants, touchParticipant } from './services/participants.js';
import {
  addStory,
  deleteStory,
  getStory,
  listStories,
  reorderStories,
  setFinalPoints,
  updateStory,
} from './services/stories.js';
import {
  createRound,
  deleteRound,
  ensureRound,
  getCurrentRound,
  revealRound,
} from './services/rounds.js';
import { castVote, getVote, listVoterIds, listVotes } from './services/votes.js';
import {
  serializeOwnVote,
  serializeParticipant,
  serializeRevealedVote,
} from './services/serialize.js';
import { computeStats } from './services/stats.js';

const room = (code) => `session:${code}`;

const MAX_TITLE = 200;
const MAX_DESC = 2000;
const MAX_REASON = 500;
const MAX_POINTS = 20;

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Registers real-time session handlers.
 *
 * Reminder for later stories: vote VALUES must never be broadcast before the
 * facilitator reveals — see the "why" note in docs/stories/STORY-006. This
 * story only deals with membership, presence, and the story list, none of which
 * carry vote data.
 */
export function registerSocketHandlers(io, db, presence) {
  const broadcastParticipants = (session) => {
    const participants = listParticipants(db, session.id).map((p) =>
      serializeParticipant(p, presence.isConnected(p.id))
    );
    io.to(room(session.code)).emit('session:participants', { participants });
  };

  // Ids of participants who have voted in the active round — never the values.
  // Safe to broadcast pre-reveal; this is the whole of STORY-007's new payload.
  const activeVoterIds = (session) => {
    const round = session?.active_story_id
      ? getCurrentRound(db, session.active_story_id)
      : null;
    return round ? listVoterIds(db, round.id) : [];
  };

  // Tells the room who has voted so far in the current round (ids only), so the
  // facilitator can gauge progress. Reset naturally follows the active story /
  // round changing, which re-runs this with a fresh (empty) voter list.
  const broadcastVoting = (sessionId) => {
    const session = getSessionById(db, sessionId);
    if (!session) return;
    const round = session.active_story_id
      ? getCurrentRound(db, session.active_story_id)
      : null;
    io.to(room(session.code)).emit('session:voting', {
      storyId: session.active_story_id ?? null,
      roundId: round?.id ?? null,
      voterIds: activeVoterIds(session),
    });
  };

  // The full reveal for a session's active round, or null if it hasn't been
  // revealed. This is the ONLY path that returns other participants' values, and
  // it is gated on `revealed_at` — see serializeRevealedVote and STORY-008.
  const revealPayload = (session) => {
    const round = session?.active_story_id
      ? getCurrentRound(db, session.active_story_id)
      : null;
    if (!round?.revealed_at) return null;

    const names = new Map(
      listParticipants(db, session.id).map((p) => [p.id, p.display_name])
    );
    const votes = listVotes(db, round.id).map((v) =>
      serializeRevealedVote(v, names.get(v.participant_id) ?? 'Unknown')
    );
    return {
      storyId: session.active_story_id,
      roundId: round.id,
      revealedAt: round.revealed_at,
      votes,
      stats: computeStats(votes),
    };
  };

  // Pushes the current reveal state to the room. Sends `null` when the active
  // round isn't revealed (e.g. after switching to a fresh story) so clients
  // clear any stale results.
  const broadcastReveal = (sessionId) => {
    const session = getSessionById(db, sessionId);
    if (!session) return;
    io.to(room(session.code)).emit('session:reveal', { reveal: revealPayload(session) });
  };

  // A participant's own vote for the active story's current round, or null.
  // This is the ONLY server path that returns a vote value, and it only ever
  // returns the caller's own — see the note on serializeOwnVote.
  const ownActiveVote = (sessionId, participantId) => {
    const session = getSessionById(db, sessionId);
    if (!session?.active_story_id) return null;
    const round = getCurrentRound(db, session.active_story_id);
    if (!round) return null;
    return serializeOwnVote(getVote(db, round.id, participantId));
  };

  // Re-reads the session so `activeStoryId` reflects the latest pointer (the FK
  // clears it automatically when the active story is deleted).
  const broadcastStories = (sessionId) => {
    const session = getSessionById(db, sessionId);
    if (!session) return;
    io.to(room(session.code)).emit('session:stories', {
      stories: listStories(db, sessionId),
      activeStoryId: session.active_story_id ?? null,
    });
  };

  io.on('connection', (socket) => {
    /**
     * The single authorization gate for privileged actions (STORY-005). A
     * socket earns facilitator rights at join time by presenting the token;
     * relax the rule for a whole class of action by loosening this one check.
     */
    const requireFacilitator = (ack) => {
      if (!socket.data.sessionId) {
        ack?.({ error: 'Join the session first' });
        return false;
      }
      if (!socket.data.isFacilitator) {
        ack?.({ error: 'Only the facilitator can do that' });
        return false;
      }
      return true;
    };

    // A client joins a session room after it has a participant id from the REST
    // create/join call. Both are validated against the DB before we trust them.
    socket.on('session:join', ({ code, participantId, facilitatorToken } = {}, ack) => {
      const session = getSessionByCode(db, code);
      if (!session) return ack?.({ error: 'Session not found' });

      const participant = getParticipant(db, participantId);
      if (!participant || participant.session_id !== session.id) {
        return ack?.({ error: 'You are not a member of this session' });
      }

      // Facilitator rights come from the token, not the participant flag, so a
      // client can't grant itself privileges by guessing a participant id.
      const isFacilitator = verifyFacilitatorToken(db, session.id, facilitatorToken);

      socket.join(room(session.code));
      socket.data.sessionId = session.id;
      socket.data.participantId = participant.id;
      socket.data.isFacilitator = isFacilitator;
      presence.add(socket.id, session.id, participant.id);
      touchParticipant(db, participant.id);

      ack?.({
        session: {
          id: session.id,
          code: session.code,
          name: session.name,
          mode: session.mode,
          kind: session.kind,
          scale: session.scale,
          activeStoryId: session.active_story_id ?? null,
          closedAt: session.closed_at,
        },
        you: { ...serializeParticipant(participant, true), isFacilitator },
        stories: listStories(db, session.id),
        yourVote: ownActiveVote(session.id, participant.id),
        voterIds: activeVoterIds(session),
        roundId: session.active_story_id
          ? (getCurrentRound(db, session.active_story_id)?.id ?? null)
          : null,
        reveal: revealPayload(session),
      });

      broadcastParticipants(session);
    });

    socket.on('story:add', ({ title, description } = {}, ack) => {
      if (!requireFacilitator(ack)) return;

      const cleanTitle = trimmed(title);
      if (!cleanTitle) return ack?.({ error: 'Story title is required' });
      if (cleanTitle.length > MAX_TITLE) return ack?.({ error: 'Story title is too long' });

      const cleanDesc = trimmed(description);
      if (cleanDesc.length > MAX_DESC) return ack?.({ error: 'Description is too long' });

      const story = addStory(db, socket.data.sessionId, {
        title: cleanTitle,
        description: cleanDesc || null,
      });
      ack?.({ story });
      broadcastStories(socket.data.sessionId);
    });

    socket.on('story:update', ({ storyId, title, description } = {}, ack) => {
      if (!requireFacilitator(ack)) return;

      const story = getStory(db, storyId);
      if (!story || story.session_id !== socket.data.sessionId) {
        return ack?.({ error: 'Story not found' });
      }

      const fields = {};
      if (title !== undefined) {
        const cleanTitle = trimmed(title);
        if (!cleanTitle) return ack?.({ error: 'Story title is required' });
        if (cleanTitle.length > MAX_TITLE) return ack?.({ error: 'Story title is too long' });
        fields.title = cleanTitle;
      }
      if (description !== undefined) {
        const cleanDesc = trimmed(description);
        if (cleanDesc.length > MAX_DESC) return ack?.({ error: 'Description is too long' });
        fields.description = cleanDesc || null;
      }

      const updated = updateStory(db, storyId, fields);
      ack?.({ story: updated });
      broadcastStories(socket.data.sessionId);
    });

    socket.on('story:delete', ({ storyId } = {}, ack) => {
      if (!requireFacilitator(ack)) return;

      const story = getStory(db, storyId);
      if (!story || story.session_id !== socket.data.sessionId) {
        return ack?.({ error: 'Story not found' });
      }

      const wasActive = getSessionById(db, socket.data.sessionId)?.active_story_id === storyId;
      deleteStory(db, storyId);
      ack?.({ ok: true });
      broadcastStories(socket.data.sessionId);
      // Deleting the active story clears the round everyone was voting on.
      if (wasActive) {
        broadcastVoting(socket.data.sessionId);
        broadcastReveal(socket.data.sessionId);
      }
    });

    socket.on('story:reorder', ({ orderedIds } = {}, ack) => {
      if (!requireFacilitator(ack)) return;
      if (!Array.isArray(orderedIds)) return ack?.({ error: 'orderedIds must be an array' });

      reorderStories(db, socket.data.sessionId, orderedIds);
      ack?.({ ok: true });
      broadcastStories(socket.data.sessionId);
    });

    socket.on('story:setActive', ({ storyId } = {}, ack) => {
      if (!requireFacilitator(ack)) return;

      try {
        setActiveStory(db, socket.data.sessionId, storyId ?? null);
      } catch {
        return ack?.({ error: 'Story not found' });
      }
      // A story being estimated always has an open round to vote against.
      if (storyId != null) ensureRound(db, storyId);
      ack?.({ ok: true });
      broadcastStories(socket.data.sessionId);
      // The round changed, so the "who has voted" list resets for everyone and
      // any previous reveal no longer applies to the newly active story.
      broadcastVoting(socket.data.sessionId);
      broadcastReveal(socket.data.sessionId);
    });

    // Any member casts or changes their own vote for the active story's round.
    // The round is resolved server-side from the active story, so a client can't
    // vote against a stale or foreign round by sending its own id.
    socket.on('vote:cast', ({ value, reason } = {}, ack) => {
      if (!socket.data.participantId) return ack?.({ error: 'Join the session first' });

      const session = getSessionById(db, socket.data.sessionId);
      if (!session?.active_story_id) return ack?.({ error: 'No story is being estimated' });

      const round = getCurrentRound(db, session.active_story_id);
      if (!round) return ack?.({ error: 'Voting has not started' });
      if (round.revealed_at) return ack?.({ error: 'Voting is closed for this round' });

      const cleanValue = trimmed(value);
      const scale = session.scale.split(',');
      if (!scale.includes(cleanValue)) return ack?.({ error: 'That value is not on the scale' });

      const reasonText = trimmed(reason);
      if (reasonText.length > MAX_REASON) return ack?.({ error: 'Reason is too long' });

      const vote = castVote(db, {
        roundId: round.id,
        participantId: socket.data.participantId,
        value: cleanValue,
        reason: reasonText || null,
      });
      // The value is acked only to the caller and never broadcast pre-reveal;
      // the room only learns that this participant has now voted.
      ack?.({ vote: serializeOwnVote(vote) });
      broadcastVoting(socket.data.sessionId);
    });

    // Returns the caller's own current vote (used after switching stories or
    // reconnecting). Carries no one else's value.
    socket.on('vote:mine', (_payload, ack) => {
      if (!socket.data.participantId) return ack?.({ vote: null });
      ack?.({ vote: ownActiveVote(socket.data.sessionId, socket.data.participantId) });
    });

    // The facilitator closes the active round and reveals every vote at once.
    // Revealing is idempotent (revealRound no-ops if already revealed) and, once
    // set, vote:cast rejects further votes for that round.
    socket.on('vote:reveal', (_payload, ack) => {
      if (!requireFacilitator(ack)) return;

      const session = getSessionById(db, socket.data.sessionId);
      if (!session?.active_story_id) return ack?.({ error: 'No story is being estimated' });

      const round = getCurrentRound(db, session.active_story_id);
      if (!round) return ack?.({ error: 'Voting has not started' });

      revealRound(db, round.id);
      const reveal = revealPayload(getSessionById(db, session.id));
      ack?.({ reveal });
      io.to(room(session.code)).emit('session:reveal', { reveal });
    });

    // The facilitator records the agreed estimate on a story. Free choice (not
    // constrained to the scale) since it's set after discussion. The value lands
    // in the story list, so everyone sees the finalized number.
    socket.on('story:finalize', ({ storyId, points } = {}, ack) => {
      if (!requireFacilitator(ack)) return;

      const story = getStory(db, storyId);
      if (!story || story.session_id !== socket.data.sessionId) {
        return ack?.({ error: 'Story not found' });
      }

      const cleanPoints = trimmed(points);
      if (!cleanPoints) return ack?.({ error: 'Final points are required' });
      if (cleanPoints.length > MAX_POINTS) return ack?.({ error: 'Final points value is too long' });

      const updated = setFinalPoints(db, storyId, cleanPoints);
      ack?.({ story: updated });
      broadcastStories(socket.data.sessionId);
    });

    // The facilitator opens a fresh round for the active story (a re-vote after
    // discussion). Prior rounds — and their votes — are retained for history;
    // presence, votes and any reveal reset because the current round changes.
    socket.on('vote:revote', (_payload, ack) => {
      if (!requireFacilitator(ack)) return;

      const session = getSessionById(db, socket.data.sessionId);
      if (!session?.active_story_id) return ack?.({ error: 'No story is being estimated' });

      // Backlog sessions keep each round for history (STORY-009/011). Quick
      // sessions (STORY-019) are ad-hoc: the reset discards the round just voted
      // on so nothing accumulates. Either way a NEW round id is what makes every
      // client clear its vote and reveal, so we always open a fresh round.
      const previous = getCurrentRound(db, session.active_story_id);
      const round = createRound(db, session.active_story_id);
      if (session.kind === 'quick' && previous) deleteRound(db, previous.id);
      ack?.({ roundId: round.id });
      broadcastVoting(socket.data.sessionId);
      broadcastReveal(socket.data.sessionId);
    });

    // The facilitator closes the session (STORY-010). It stays readable in the
    // history list but is marked closed and no longer accepts new members (the
    // join REST route already rejects closed sessions). Connected members are
    // told live so their UI can reflect the closed state.
    socket.on('session:close', (_payload, ack) => {
      if (!requireFacilitator(ack)) return;

      const session = getSessionById(db, socket.data.sessionId);
      if (!session) return ack?.({ error: 'Session not found' });

      const closed = closeSession(db, session.id);
      ack?.({ closedAt: closed.closed_at });
      io.to(room(session.code)).emit('session:closed', { closedAt: closed.closed_at });
    });

    socket.on('disconnect', () => {
      const entry = presence.remove(socket.id);
      if (!entry) return;
      const session = getSessionById(db, entry.sessionId);
      if (session) broadcastParticipants(session);
    });
  });

  return io;
}
