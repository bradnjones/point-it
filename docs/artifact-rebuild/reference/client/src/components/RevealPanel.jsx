import { useState } from 'react';

/**
 * The revealed round: every participant's value and reason at once, plus the
 * round stats. Rendered only once the facilitator reveals — before that the
 * server never sends anyone else's value (docs/stories/STORY-006).
 *
 * Post-reveal is also where the facilitator drives what happens next
 * (STORY-009): agree a final number, or re-vote for another round.
 */
export default function RevealPanel({
  reveal,
  isFacilitator = false,
  onRevote,
  onFinalize,
  quick = false,
  hoursPerPoint = null,
}) {
  const [points, setPoints] = useState('');
  const [error, setError] = useState('');

  if (!reveal) return null;

  const { votes, stats } = reveal;

  // Time equivalent of the average estimate, shown only when the session has a
  // rate and there are numeric votes to average. Rounded to one decimal so a
  // 2h/point rate on an average of 5.5 reads as "11h", not "11.0000000001h".
  const showTime = hoursPerPoint != null && stats.average != null;
  const estHours = showTime ? Math.round(stats.average * hoursPerPoint * 10) / 10 : null;

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
        {showTime && (
          <div>
            <dt>Est. time</dt>
            <dd>{estHours}h</dd>
          </div>
        )}
        <div>
          <dt>Votes</dt>
          <dd>{stats.count}</dd>
        </div>
      </dl>

      {showTime && <p className="hint rate-note">At {hoursPerPoint}h per point.</p>}

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
          {/* Quick sessions have no persistent story to record points against,
              so they skip finalize; the reset ("New round") is the whole loop. */}
          {!quick && (
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
          )}
          <button type="button" className="revote-btn" onClick={() => run(onRevote)}>
            {quick ? 'New round' : 'Re-vote'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
