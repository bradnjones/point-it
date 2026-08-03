const NAME_ADJECTIVES = [
  'Swift', 'Bold', 'Calm', 'Bright', 'Keen', 'Brave', 'Quick', 'Wise',
  'Merry', 'Nimble', 'Lucky', 'Clever',
];
const NAME_ANIMALS = [
  'Otter', 'Fox', 'Hawk', 'Panda', 'Lynx', 'Heron', 'Bison', 'Koala',
  'Falcon', 'Badger', 'Wren', 'Moose',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * A friendly, readable display name (e.g. "Swift Otter") for participants who
 * don't supply one — the join screen no longer asks. Not guaranteed unique, but
 * the combination space is large enough for a room and the "you" badge plus the
 * participant id still disambiguate.
 */
export function generateDisplayName() {
  return `${pick(NAME_ADJECTIVES)} ${pick(NAME_ANIMALS)}`;
}

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
