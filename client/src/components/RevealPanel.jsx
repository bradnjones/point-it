import { useState } from 'react';

/**
 * The revealed round: every participant's value and reason at once, plus the
 * round stats. Rendered only once the facilitator reveals — before that the
 * server never sends anyone else's value (docs/stories/STORY-006).
 *
 * Post-reveal is also where the facilitator drives what happens next
 * (STORY-009): agree a final number, or re-vote for another round.
 */
export default function RevealPanel({ reveal, isFacilitator = false, onRevote, onFinalize }) {
  const [points, setPoints] = useState('');
  const [error, setError] = useState('');

  if (!reveal) return null;

  const { votes, stats } = reveal;

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  };

  async function finalize(e) {
    e.preventDefault();
    await run(() => onFinalize(reveal.storyId, points.trim()));
  }

  return (
    <section className="panel reveal">
      <h2>Revealed {stats.consensus && <span className="badge consensus">consensus</span>}</h2>

      <dl className="stats">
        <div>
          <dt>Average</dt>
          <dd>{stats.average ?? '—'}</dd>
        </div>
        <div>
          <dt>Spread</dt>
          <dd>{stats.spread == null ? '—' : `${stats.min}–${stats.max}`}</dd>
        </div>
        <div>
          <dt>Votes</dt>
          <dd>{stats.count}</dd>
        </div>
      </dl>

      <ul className="distribution">
        {stats.distribution.map(({ value, count }) => (
          <li key={value}>
            <span className="chip">{value}</span>
            <span className="dist-count">×{count}</span>
          </li>
        ))}
      </ul>

      <ul className="reveal-votes">
        {votes.map((v) => (
          <li key={v.participantId}>
            <span className="reveal-name">{v.displayName}</span>
            <span className="reveal-value">{v.value}</span>
            {v.reason && <span className="reveal-reason">{v.reason}</span>}
          </li>
        ))}
      </ul>

      {isFacilitator && (
        <div className="reveal-actions">
          <form className="finalize-form" onSubmit={finalize}>
            <input
              aria-label="Final points"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Final points"
            />
            <button type="submit" disabled={points.trim().length === 0}>
              Finalize
            </button>
          </form>
          <button type="button" className="revote-btn" onClick={() => run(onRevote)}>
            Re-vote
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
