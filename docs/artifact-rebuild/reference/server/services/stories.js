export function addStory(db, sessionId, { title, description = null, externalRef = null }) {
  const nextPosition =
    db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM stories WHERE session_id = ?').get(
      sessionId
    ).pos;

  const info = db
    .prepare(
      `INSERT INTO stories (session_id, title, description, external_ref, position)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(sessionId, title, description, externalRef, nextPosition);
  return getStory(db, info.lastInsertRowid);
}

export function getStory(db, id) {
  return db.prepare('SELECT * FROM stories WHERE id = ?').get(id) ?? null;
}

export function listStories(db, sessionId) {
  return db
    .prepare('SELECT * FROM stories WHERE session_id = ? ORDER BY position, id')
    .all(sessionId);
}

export function updateStory(db, id, fields) {
  const allowed = ['title', 'description', 'external_ref', 'final_points', 'position'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) return getStory(db, id);

  const setClause = entries.map(([key]) => `${key} = @${key}`).join(', ');
  const params = Object.fromEntries(entries);
  db.prepare(`UPDATE stories SET ${setClause} WHERE id = @id`).run({ ...params, id });
  return getStory(db, id);
}

export function deleteStory(db, id) {
  db.prepare('DELETE FROM stories WHERE id = ?').run(id);
}

/**
 * Reorders a session's stories to match `orderedIds`, assigning positions
 * 0..n-1. Only ids that actually belong to the session are moved, so a stale
 * or spoofed list can't touch another session's rows. Runs in one transaction
 * so the list is never observed half-reordered.
 */
export function reorderStories(db, sessionId, orderedIds) {
  const owned = new Set(
    db.prepare('SELECT id FROM stories WHERE session_id = ?').all(sessionId).map((r) => r.id)
  );
  const setPosition = db.prepare('UPDATE stories SET position = ? WHERE id = ? AND session_id = ?');

  db.transaction(() => {
    let position = 0;
    for (const id of orderedIds) {
      if (owned.has(id)) setPosition.run(position++, id, sessionId);
    }
  })();

  return listStories(db, sessionId);
}

/** Records the agreed estimate for a story (STORY-009). */
export function setFinalPoints(db, id, finalPoints) {
  return updateStory(db, id, { final_points: String(finalPoints) });
}
