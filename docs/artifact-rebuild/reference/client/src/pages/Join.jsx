import { useState } from 'react';
import { createSession, joinSession } from '../lib/api.js';

// Built-in point scales. 'custom' lets the facilitator type any comma-separated
// scale; the server has final say on validation.
const SCALE_PRESETS = {
  fibonacci: '1,2,3,5,8,13,21,?',
  linear: '1,2,3,4,5,6,7,8,9,10',
};

/**
 * Join screen: create a new session (you become facilitator) or join an
 * existing one by code. On success it hands a membership up to App.
 */
export default function Join({ onJoined, onShowHistory }) {
  const [sessionName, setSessionName] = useState('');
  const [kind, setKind] = useState('stories');
  const [scalePreset, setScalePreset] = useState('fibonacci');
  const [customScale, setCustomScale] = useState('');
  const [hoursPerPoint, setHoursPerPoint] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const scale = scalePreset === 'custom' ? customScale : SCALE_PRESETS[scalePreset];
      const { session, participant, facilitatorToken } = await createSession({
        name: sessionName,
        kind,
        scale,
        hoursPerPoint: hoursPerPoint.trim() || undefined,
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
      const { session, participant } = await joinSession({ code });
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

  return (
    <main className="join">
      <h1>point-it</h1>
      <p className="tagline">Estimate stories together, without anchoring.</p>

      <form className="join-form">
        <fieldset className="panel-group">
          <legend>Join a session</legend>
          <label>
            Session code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="6-character code"
              maxLength={6}
              autoFocus
            />
          </label>
          <button
            type="submit"
            onClick={handleJoin}
            disabled={busy || code.trim().length < 6}
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

          <label>
            Point scale
            <select value={scalePreset} onChange={(e) => setScalePreset(e.target.value)}>
              <option value="fibonacci">Fibonacci (1, 2, 3, 5, 8, 13, 21, ?)</option>
              <option value="linear">Linear 1–10</option>
              <option value="custom">Custom…</option>
            </select>
          </label>

          {scalePreset === 'custom' && (
            <label>
              Custom scale
              <input
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                placeholder="Comma-separated, e.g. 1,2,3,4,5"
              />
            </label>
          )}

          <label>
            Hours per point (optional)
            <input
              type="number"
              min="0"
              step="0.5"
              value={hoursPerPoint}
              onChange={(e) => setHoursPerPoint(e.target.value)}
              placeholder="e.g. 2"
            />
          </label>

          <button
            type="submit"
            onClick={handleCreate}
            disabled={busy || sessionName.trim().length === 0}
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
