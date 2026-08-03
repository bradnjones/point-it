/**
 * The revealed round: every participant's value and reason at once, plus the
 * round stats. Rendered only once the facilitator reveals — before that the
 * server never sends anyone else's value (docs/stories/STORY-006).
 */
export default function RevealPanel({ reveal }) {
  if (!reveal) return null;

  const { votes, stats } = reveal;

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
    </section>
  );
}
