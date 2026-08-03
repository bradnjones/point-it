import { useEffect, useState } from 'react';
import { getSessions } from '../lib/api.js';

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
};

/**
 * Browse past sessions, newest first (STORY-010). Read-only summary counts and
 * an active/closed status. Detail drill-in arrives with STORY-011; `onOpen`, if
 * provided, makes each row a link to it.
 */
export default function History({ onBack, onOpen }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getSessions()
      .then(({ sessions }) => live && setSessions(sessions))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="history">
      <header className="history-header">
        <h1>Past sessions</h1>
        <button type="button" className="link" onClick={onBack}>
          Back
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {!error && sessions === null && <p className="hint">Loading…</p>}

      {sessions !== null && sessions.length === 0 && (
        <p className="hint">No sessions yet. Start one to see it here.</p>
      )}

      {sessions !== null && sessions.length > 0 && (
        <ul className="history-list">
          {sessions.map((s) => {
            const Row = onOpen ? 'button' : 'div';
            return (
              <li key={s.id}>
                <Row
                  className="history-row"
                  {...(onOpen ? { type: 'button', onClick: () => onOpen(s.code) } : {})}
                >
                  <div className="history-main">
                    <span className="history-name">{s.name}</span>
                    <span className={`badge status ${s.status}`}>{s.status}</span>
                  </div>
                  <div className="history-meta">
                    <span>{formatDate(s.createdAt)}</span>
                    <span>
                      {s.storyCount} {s.storyCount === 1 ? 'story' : 'stories'}
                    </span>
                    <span>
                      {s.participantCount}{' '}
                      {s.participantCount === 1 ? 'participant' : 'participants'}
                    </span>
                  </div>
                </Row>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
