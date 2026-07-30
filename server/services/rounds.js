/**
 * Opens a new voting round for a story. Each re-vote (STORY-009) is a new round;
 * prior rounds are retained for history.
 */
export function createRound(db, storyId) {
  const nextNumber =
    db.prepare('SELECT COALESCE(MAX(round_number), 0) + 1 AS n FROM rounds WHERE story_id = ?').get(
      storyId
    ).n;

  const info = db
    .prepare('INSERT INTO rounds (story_id, round_number) VALUES (?, ?)')
    .run(storyId, nextNumber);
  return getRound(db, info.lastInsertRowid);
}

export function getRound(db, id) {
  return db.prepare('SELECT * FROM rounds WHERE id = ?').get(id) ?? null;
}

/** The latest round for a story, or null if voting hasn't started. */
export function getCurrentRound(db, storyId) {
  return (
    db
      .prepare('SELECT * FROM rounds WHERE story_id = ? ORDER BY round_number DESC LIMIT 1')
      .get(storyId) ?? null
  );
}

export function listRounds(db, storyId) {
  return db.prepare('SELECT * FROM rounds WHERE story_id = ? ORDER BY round_number').all(storyId);
}

/** Marks a round revealed (STORY-008); votes are then visible and locked. */
export function revealRound(db, id) {
  db.prepare(
    `UPDATE rounds SET revealed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND revealed_at IS NULL`
  ).run(id);
  return getRound(db, id);
}

export function isRevealed(db, id) {
  return Boolean(getRound(db, id)?.revealed_at);
}
