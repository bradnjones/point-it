import { useEffect, useState } from 'react';

/**
 * Your private vote for the active story. Presentational and socket-free: it
 * only ever knows YOUR own vote — the server never sends anyone else's value
 * before reveal (docs/stories/STORY-006). Selecting a scale value and
 * submitting calls onCast; the parent seeds `yourVote` from the server.
 */
export default function VotePanel({ activeStory, scale, yourVote, onCast }) {
  const [value, setValue] = useState(yourVote?.value ?? '');
  const [reason, setReason] = useState(yourVote?.reason ?? '');
  const [error, setError] = useState('');

  // Re-sync the form when the server's view of your vote changes, including the
  // reset to empty when the active story switches.
  useEffect(() => {
    setValue(yourVote?.value ?? '');
    setReason(yourVote?.reason ?? '');
    setError('');
  }, [yourVote, activeStory?.id]);

  if (!activeStory) {
    return (
      <section className="panel">
        <h2>Your vote</h2>
        <p className="hint">Waiting for the facilitator to start a story.</p>
      </section>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await onCast(value, reason.trim());
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel">
      <h2>Your vote</h2>
      <p className="vote-story">{activeStory.title}</p>

      <form onSubmit={submit}>
        <div className="scale" role="group" aria-label="Estimate">
          {scale.map((v) => (
            <button
              type="button"
              key={v}
              className={`chip${v === value ? ' selected' : ''}`}
              aria-pressed={v === value}
              onClick={() => setValue(v)}
            >
              {v}
            </button>
          ))}
        </div>

        <textarea
          aria-label="Reason (optional)"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />

        <button type="submit" disabled={!value}>
          {yourVote ? 'Update vote' : 'Cast vote'}
        </button>
      </form>

      {yourVote && (
        <p className="hint">Your estimate is in — you can change it until the reveal.</p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
