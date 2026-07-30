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
export function createSession(db, { name, mode = 'free_form', scale }) {
  const facilitatorToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(facilitatorToken).digest('hex');

  const insert = db.prepare(
    `INSERT INTO sessions (code, name, mode, scale, facilitator_token)
     VALUES (@code, @name, @mode, @scale, @tokenHash)`
  );

  // Retry on the vanishingly rare code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const info = insert.run({
        code,
        name,
        mode,
        scale: scale ?? '1,2,3,5,8,13,21,?',
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

export function closeSession(db, id) {
  db.prepare(
    `UPDATE sessions SET closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(id);
  return getSessionById(db, id);
}

/** Sessions newest-first, with story and participant counts for the list view. */
export function listSessions(db) {
  return db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM stories WHERE session_id = s.id)      AS story_count,
              (SELECT COUNT(*) FROM participants WHERE session_id = s.id) AS participant_count
       FROM sessions s
       ORDER BY s.created_at DESC, s.id DESC`
    )
    .all();
}
