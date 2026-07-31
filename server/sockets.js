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
import { serializeParticipant } from './services/serialize.js';

const room = (code) => `session:${code}`;

const MAX_TITLE = 200;
const MAX_DESC = 2000;

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

      deleteStory(db, storyId);
      ack?.({ ok: true });
      broadcastStories(socket.data.sessionId);
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
      ack?.({ ok: true });
      broadcastStories(socket.data.sessionId);
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
