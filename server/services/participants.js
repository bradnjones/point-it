export function addParticipant(db, sessionId, { displayName, isFacilitator = false }) {
  const info = db
    .prepare(
      `INSERT INTO participants (session_id, display_name, is_facilitator)
       VALUES (?, ?, ?)`
    )
    .run(sessionId, displayName, isFacilitator ? 1 : 0);
  return getParticipant(db, info.lastInsertRowid);
}

export function getParticipant(db, id) {
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(id) ?? null;
}

export function listParticipants(db, sessionId) {
  return db
    .prepare('SELECT * FROM participants WHERE session_id = ? ORDER BY joined_at, id')
    .all(sessionId);
}

/** Marks a participant as recently active (presence, STORY-007). */
export function touchParticipant(db, id) {
  db.prepare(
    `UPDATE participants SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(id);
  return getParticipant(db, id);
}
