import { useEffect, useState } from 'react';
import { connectSocket, socket } from '../lib/socket.js';

/**
 * Placeholder join screen. The form is inert for now — creating and joining
 * real sessions lands in STORY-004.
 */
export default function Join() {
  const [connected, setConnected] = useState(socket.connected);
  const [displayName, setDisplayName] = useState('');
  const [sessionCode, setSessionCode] = useState('');

  useEffect(() => {
    connectSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <main className="join">
      <h1>point-it</h1>
      <p className="tagline">Estimate stories together, without anchoring.</p>

      <form className="join-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          Your name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Brad"
          />
        </label>

        <label>
          Session code
          <input
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            placeholder="6-character code"
            maxLength={6}
          />
        </label>

        <div className="actions">
          <button type="submit" disabled>
            Join session
          </button>
          <button type="button" disabled>
            Create session
          </button>
        </div>
        <p className="hint">Session create/join arrives in STORY-004.</p>
      </form>

      <p className={connected ? 'status status-ok' : 'status status-down'}>
        {connected ? 'Connected to server' : 'Not connected'}
      </p>
    </main>
  );
}
