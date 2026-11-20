/**
 * Records or updates a participant's vote for a round. One vote per participant
 * per round (enforced by a UNIQUE constraint), so re-submitting overwrites.
 *
 * Accepts either a free-form `value` or the three PERT numbers. Callers pass the
 * shape appropriate to the session mode.
 */
export function castVote(db, { roundId, participantId, value = null, pert = null, reason = null }) {
  const row = {
    roundId,
    participantId,
    value: value ?? null,
    o: pert?.optimistic ?? null,
    m: pert?.likely ?? null,
    p: pert?.pessimistic ?? null,
    reason: reason ?? null,
  };

  db.prepare(
    `INSERT INTO votes (round_id, participant_id, value, pert_optimistic, pert_likely, pert_pessimistic, reason)
     VALUES (@roundId, @participantId, @value, @o, @m, @p, @reason)
     ON CONFLICT (round_id, participant_id) DO UPDATE SET
       value            = excluded.value,
       pert_optimistic  = excluded.pert_optimistic,
       pert_likely      = excluded.pert_likely,
       pert_pessimistic = excluded.pert_pessimistic,
       reason           = excluded.reason,
       created_at       = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  ).run(row);

  return getVote(db, roundId, participantId);
}

export function getVote(db, roundId, participantId) {
  return (
    db
      .prepare('SELECT * FROM votes WHERE round_id = ? AND participant_id = ?')
      .get(roundId, participantId) ?? null
  );
}

/**
 * All votes for a round. WARNING: this returns vote VALUES. Do not send the
 * result to clients before the round is revealed — see the "why" note in
 * docs/stories/STORY-006. Pre-reveal, use countVotes / listVoterIds instead.
 */
export function listVotes(db, roundId) {
  return db.prepare('SELECT * FROM votes WHERE round_id = ? ORDER BY id').all(roundId);
}

/** Count of votes cast in a round — safe to broadcast pre-reveal. */
export function countVotes(db, roundId) {
  return db.prepare('SELECT COUNT(*) AS n FROM votes WHERE round_id = ?').get(roundId).n;
}

/** Which participants have voted — safe pre-reveal; carries no values. */
export function listVoterIds(db, roundId) {
  return db
    .prepare('SELECT participant_id FROM votes WHERE round_id = ?')
    .all(roundId)
    .map((r) => r.participant_id);
}
