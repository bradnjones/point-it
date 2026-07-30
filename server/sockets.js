import { getSessionByCode } from './services/sessions.js';
import { getParticipant, listParticipants, touchParticipant } from './services/participants.js';
import { serializeParticipant } from './services/serialize.js';

const room = (code) => `session:${code}`;

/**
 * Registers real-time session handlers.
 *
 * Reminder for later stories: vote VALUES must never be broadcast before the
 * facilitator reveals — see the "why" note in docs/stories/STORY-006. This
 * story only deals with membership and presence, which carry no vote data.
 */
export function registerSocketHandlers(io, db, presence) {
  const broadcastParticipants = (session) => {
    const participants = listParticipants(db, session.id).map((p) =>
      serializeParticipant(p, presence.isConnected(p.id))
    );
    io.to(room(session.code)).emit('session:participants', { participants });
  };

  io.on('connection', (socket) => {
    // A client joins a session room after it has a participant id from the REST
    // create/join call. Both are validated against the DB before we trust them.
    socket.on('session:join', ({ code, participantId } = {}, ack) => {
      const session = getSessionByCode(db, code);
      if (!session) return ack?.({ error: 'Session not found' });

      const participant = getParticipant(db, participantId);
      if (!participant || participant.session_id !== session.id) {
        return ack?.({ error: 'You are not a member of this session' });
      }

      socket.join(room(session.code));
      presence.add(socket.id, session.id, participant.id);
      touchParticipant(db, participant.id);

      ack?.({
        session: {
          id: session.id,
          code: session.code,
          name: session.name,
          mode: session.mode,
          scale: session.scale,
          closedAt: session.closed_at,
        },
        you: serializeParticipant(participant, true),
      });

      broadcastParticipants(session);
    });

    socket.on('disconnect', () => {
      const entry = presence.remove(socket.id);
      if (!entry) return;
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(entry.sessionId);
      if (session) broadcastParticipants(session);
    });
  });

  return io;
}
