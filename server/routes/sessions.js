import { Router } from 'express';
import {
  countSessions,
  createSession,
  getSessionByCode,
  listSessions,
  setActiveStory,
} from '../services/sessions.js';
import { addParticipant, listParticipants } from '../services/participants.js';
import { addStory, listStories } from '../services/stories.js';
import { ensureRound } from '../services/rounds.js';
import {
  serializeParticipant,
  serializeSession,
  serializeSessionSummary,
} from '../services/serialize.js';

const MAX_NAME = 80;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Parses a non-negative integer query param, falling back when absent/invalid.
const intParam = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Session REST routes. `presence` is the live connection tracker owned by the
 * socket layer; it is injected so participant lists carry a `connected` flag.
 */
export function createSessionRouter(db, presence) {
  const router = Router();

  const withConnected = (participant) =>
    serializeParticipant(participant, presence?.isConnected(participant.id) ?? false);

  // Create a session; the creator becomes the facilitator.
  router.post('/', (req, res) => {
    const name = trimmed(req.body?.name);
    const displayName = trimmed(req.body?.displayName);
    const mode = req.body?.mode === 'pert' ? 'pert' : 'free_form';
    const kind = req.body?.kind === 'quick' ? 'quick' : 'stories';

    if (!name) return res.status(400).json({ error: 'Session name is required' });
    if (!displayName) return res.status(400).json({ error: 'Your name is required' });
    if (name.length > MAX_NAME || displayName.length > MAX_NAME) {
      return res.status(400).json({ error: 'Name is too long' });
    }

    let { session, facilitatorToken } = createSession(db, { name, mode, kind });
    const participant = addParticipant(db, session.id, { displayName, isFacilitator: true });

    // A quick session has no managed backlog: it estimates repeated rounds
    // against one implicit, always-active story so members can throw points the
    // moment they join, with no "start a story" step. Provisioned atomically so
    // the session is never observed active-but-round-less.
    if (kind === 'quick') {
      session = db.transaction(() => {
        const story = addStory(db, session.id, { title: 'Quick estimate' });
        ensureRound(db, story.id);
        return setActiveStory(db, session.id, story.id);
      })();
    }

    res.status(201).json({
      session: serializeSession(session),
      participant: withConnected(participant),
      facilitatorToken,
    });
  });

  // Join an existing session by code.
  router.post('/:code/join', (req, res) => {
    const displayName = trimmed(req.body?.displayName);
    if (!displayName) return res.status(400).json({ error: 'Your name is required' });
    if (displayName.length > MAX_NAME) return res.status(400).json({ error: 'Name is too long' });

    const session = getSessionByCode(db, req.params.code);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.closed_at) return res.status(410).json({ error: 'This session has been closed' });

    const participant = addParticipant(db, session.id, { displayName, isFacilitator: false });

    res.status(201).json({
      session: serializeSession(session),
      participant: withConnected(participant),
    });
  });

  // Fetch current session state — used to rehydrate after a refresh/reconnect.
  router.get('/:code', (req, res) => {
    const session = getSessionByCode(db, req.params.code);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session: serializeSession(session),
      participants: listParticipants(db, session.id).map(withConnected),
      stories: listStories(db, session.id),
    });
  });

  // Session history list, newest-first with summary counts (STORY-010). Paged
  // via ?limit/&offset; `total` lets the client show/advance pages.
  router.get('/', (req, res) => {
    const limit = Math.min(intParam(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = intParam(req.query.offset, 0);

    res.json({
      sessions: listSessions(db, { limit, offset }).map(serializeSessionSummary),
      total: countSessions(db),
      limit,
      offset,
    });
  });

  return router;
}
