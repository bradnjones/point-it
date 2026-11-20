import crypto from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const CODE_LENGTH = 6;

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Creates a session with a unique share code. Returns the row plus the plain
 * facilitator token, which is only ever returned here (the DB stores its hash).
 */
export function createSession(
  db,
  { name, mode = 'free_form', kind = 'stories', scale, hoursPerPoint = null }
) {
  const facilitatorToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(facilitatorToken).digest('hex');

  const insert = db.prepare(
    `INSERT INTO sessions (code, name, mode, kind, scale, hours_per_point, facilitator_token)
     VALUES (@code, @name, @mode, @kind, @scale, @hoursPerPoint, @tokenHash)`
  );

  // Retry on the vanishingly rare code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const info = insert.run({
        code,
        name,
        mode,
        kind,
        scale: scale ?? '1,2,3,5,8,13,21,?',
        hoursPerPoint: hoursPerPoint ?? null,
        tokenHash,
      });
      return { session: getSessionById(db, info.lastInsertRowid), facilitatorToken };
    } catch (err) {
      if (!String(err.message).includes('UNIQUE') || attempt === 4) throw err;
    }
  }
}

export function getSessionById(db, id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) ?? null;
}

export function getSessionByCode(db, code) {
  return db.prepare('SELECT * FROM sessions WHERE code = ?').get(String(code).toUpperCase()) ?? null;
}

export function verifyFacilitatorToken(db, sessionId, token) {
  const session = getSessionById(db, sessionId);
  if (!session || !token) return false;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(session.facilitator_token), Buffer.from(hash));
}

/**
 * Sets the story everyone is currently estimating (STORY-005). Passing null
 * clears it. A storyId that doesn't belong to this session is rejected so a
 * stale client can't point the room at another session's story.
 */
export function setActiveStory(db, sessionId, storyId) {
  if (storyId != null) {
    const belongs = db
      .prepare('SELECT 1 FROM stories WHERE id = ? AND session_id = ?')
      .get(storyId, sessionId);
    if (!belongs) throw new Error('Story does not belong to this session');
  }
  db.prepare('UPDATE sessions SET active_story_id = ? WHERE id = ?').run(storyId ?? null, sessionId);
  return getSessionById(db, sessionId);
}

export function closeSession(db, id) {
  db.prepare(
    `UPDATE sessions SET closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(id);
  return getSessionById(db, id);
}

/**
 * Sessions newest-first, with story and participant counts for the history list
 * (STORY-010). Paged via limit/offset; the caller clamps the page size.
 */
export function listSessions(db, { limit = 50, offset = 0 } = {}) {
  return db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM stories WHERE session_id = s.id)      AS story_count,
              (SELECT COUNT(*) FROM participants WHERE session_id = s.id) AS participant_count
       FROM sessions s
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
}

/** Total number of sessions, for history paging. */
export function countSessions(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
}
