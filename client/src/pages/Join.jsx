import { useState } from 'react';
import { createSession, joinSession } from '../lib/api.js';

/**
 * Join screen: create a new session (you become facilitator) or join an
 * existing one by code. On success it hands a membership up to App.
 */
export default function Join({ onJoined, onShowHistory }) {
  const [displayName, setDisplayName] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [kind, setKind] = useState('stories');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { session, participant, facilitatorToken } = await createSession({
        name: sessionName,
        displayName,
        kind,
      });
      onJoined({
        code: session.code,
        participantId: participant.id,
        displayName: participant.displayName,
        isFacilitator: true,
        facilitatorToken,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { session, participant } = await joinSession({ code, displayName });
      onJoined({
        code: session.code,
        participantId: participant.id,
        displayName: participant.displayName,
        isFacilitator: false,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const nameValid = displayName.trim().length > 0;

  return (
    <main className="join">
      <h1>point-it</h1>
      <p className="tagline">Estimate stories together, without anchoring.</p>

      <form className="join-form">
        <label>
          Your name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Brad"
            autoFocus
          />
        </label>

        <fieldset className="panel-group">
          <legend>Join a session</legend>
          <label>
            Session code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="6-character code"
              maxLength={6}
            />
          </label>
          <button
            type="submit"
            onClick={handleJoin}
            disabled={busy || !nameValid || code.trim().length < 6}
          >
            Join session
          </button>
        </fieldset>

        <div className="divider">or</div>

        <fieldset className="panel-group">
          <legend>Start a new session</legend>
          <label>
            Session name
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder={
                kind === 'quick' ? 'e.g. Sprint 42 quick points' : 'e.g. Sprint 42 refinement'
              }
            />
          </label>

          <div className="kind-choice" role="radiogroup" aria-label="Session type">
            <label className={`kind-option${kind === 'stories' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="kind"
                value="stories"
                checked={kind === 'stories'}
                onChange={() => setKind('stories')}
              />
              <span className="kind-title">Story backlog</span>
              <span className="kind-desc">Add stories and estimate them one by one.</span>
            </label>
            <label className={`kind-option${kind === 'quick' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="kind"
                value="quick"
                checked={kind === 'quick'}
                onChange={() => setKind('quick')}
              />
              <span className="kind-title">Quick estimate</span>
              <span className="kind-desc">
                Throw points, reveal, reset — no stories to manage.
              </span>
            </label>
          </div>

          <button
            type="submit"
            onClick={handleCreate}
            disabled={busy || !nameValid || sessionName.trim().length === 0}
          >
            Create session
          </button>
        </fieldset>

        {error && <p className="error">{error}</p>}
      </form>

      {onShowHistory && (
        <button type="button" className="link history-link" onClick={onShowHistory}>
          View past sessions
        </button>
      )}
    </main>
  );
}
