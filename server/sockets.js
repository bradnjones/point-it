import {
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
  updateStory,
} from './services/stories.js';
import { ensureRound, getCurrentRound } from './services/rounds.js';
import { castVote, getVote, listVoterIds } from './services/votes.js';
import { serializeOwnVote, serializeParticipant } from './services/serialize.js';

const room = (code) => `session:${code}`;

const MAX_TITLE = 200;
const MAX_DESC = 2000;
const MAX_REASON = 500;

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
          scale: session.scale,
          activeStoryId: session.active_story_id ?? null,
          closedAt: session.closed_at,
        },
        you: { ...serializeParticipant(participant, true), isFacilitator },
        stories: listStories(db, session.id),
        yourVote: ownActiveVote(session.id, participant.id),
        voterIds: activeVoterIds(session),
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
      if (wasActive) broadcastVoting(socket.data.sessionId);
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
      // The round changed, so the "who has voted" list resets for everyone.
      broadcastVoting(socket.data.sessionId);
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

    socket.on('disconnect', () => {
      const entry = presence.remove(socket.id);
      if (!entry) return;
      const session = getSessionById(db, entry.sessionId);
      if (session) broadcastParticipants(session);
    });
  });

  return io;
}
