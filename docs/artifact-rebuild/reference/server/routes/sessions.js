import { Router } from 'express';
import {
  countSessions,
  createSession,
  getSessionByCode,
  listSessions,
  setActiveStory,
} from '../services/sessions.js';
import {
  addParticipant,
  generateDisplayName,
  listParticipants,
} from '../services/participants.js';
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

const DEFAULT_SCALE = '1,2,3,5,8,13,21,?';
const MAX_SCALE_VALUES = 20;
const MAX_SCALE_TOKEN = 8;
const MAX_HOURS_PER_POINT = 100;

/**
 * Normalizes a requested point scale into a clean comma-separated string.
 * Accepts a comma string or an array; trims, drops blanks, and de-dupes while
 * preserving order. Returns { scale } on success or { error } if the result is
 * unusable — a scale drives both voting and validation, so a malformed one must
 * be rejected rather than silently defaulted.
 */
function normalizeScale(raw) {
  if (raw == null || raw === '') return { scale: DEFAULT_SCALE };

  const tokens = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0);

  const unique = [...new Set(tokens)];
  if (unique.length < 2) return { error: 'A scale needs at least two distinct values' };
  if (unique.length > MAX_SCALE_VALUES) return { error: 'That scale has too many values' };
  if (unique.some((t) => t.length > MAX_SCALE_TOKEN)) {
    return { error: 'A scale value is too long' };
  }
  return { scale: unique.join(',') };
}

/**
 * Parses an optional hours-per-point rate. Absent/blank means "no time
 * mapping" (null). A present value must be a positive, finite number within a
 * sane bound; anything else is rejected so bad input can't be stored.
 */
function normalizeHoursPerPoint(raw) {
  if (raw == null || raw === '') return { hoursPerPoint: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_HOURS_PER_POINT) {
    return { error: 'Hours per point must be a positive number' };
  }
  return { hoursPerPoint: n };
}

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
    // The join screen no longer asks for a name; a blank one is auto-assigned.
    const providedName = trimmed(req.body?.displayName);
    const mode = req.body?.mode === 'pert' ? 'pert' : 'free_form';
    const kind = req.body?.kind === 'quick' ? 'quick' : 'stories';

    if (!name) return res.status(400).json({ error: 'Session name is required' });
    if (name.length > MAX_NAME || providedName.length > MAX_NAME) {
      return res.status(400).json({ error: 'Name is too long' });
    }
    const displayName = providedName || generateDisplayName();

    const scaleResult = normalizeScale(req.body?.scale);
    if (scaleResult.error) return res.status(400).json({ error: scaleResult.error });
    const hoursResult = normalizeHoursPerPoint(req.body?.hoursPerPoint);
    if (hoursResult.error) return res.status(400).json({ error: hoursResult.error });

    let { session, facilitatorToken } = createSession(db, {
      name,
      mode,
      kind,
      scale: scaleResult.scale,
      hoursPerPoint: hoursResult.hoursPerPoint,
    });
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
    const providedName = trimmed(req.body?.displayName);
    if (providedName.length > MAX_NAME) return res.status(400).json({ error: 'Name is too long' });
    const displayName = providedName || generateDisplayName();

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
