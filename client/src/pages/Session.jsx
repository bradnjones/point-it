import { useEffect, useState } from 'react';
import { connectSocket, socket } from '../lib/socket.js';

/**
 * The live session shell: session name, shareable code, and a participant list
 * that updates in real time as people connect and disconnect. Voting and
 * stories arrive in later stories.
 */
export default function Session({ membership, onLeave }) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    connectSocket();

    const doJoin = () => {
      socket.emit(
        'session:join',
        { code: membership.code, participantId: membership.participantId },
        (ack) => {
          if (ack?.error) setJoinError(ack.error);
          else setSession(ack.session);
        }
      );
    };

    const onParticipants = ({ participants }) => setParticipants(participants);

    socket.on('connect', doJoin);
    socket.on('session:participants', onParticipants);
    if (socket.connected) doJoin();

    return () => {
      socket.off('connect', doJoin);
      socket.off('session:participants', onParticipants);
    };
  }, [membership.code, membership.participantId]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(membership.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the code is shown regardless.
    }
  }

  if (joinError) {
    return (
      <main className="session">
        <p className="error">{joinError}</p>
        <button type="button" onClick={onLeave}>
          Back to start
        </button>
      </main>
    );
  }

  return (
    <main className="session">
      <header className="session-header">
        <div>
          <h1>{session?.name ?? 'Joining…'}</h1>
          <button type="button" className="code-chip" onClick={copyCode} title="Copy code">
            {membership.code} {copied ? '✓' : '⧉'}
          </button>
        </div>
        <button type="button" className="link" onClick={onLeave}>
          Leave
        </button>
      </header>

      <section className="panel">
        <h2>Participants ({participants.length})</h2>
        <ul className="participants">
          {participants.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              <span className={`dot ${p.connected ? 'on' : 'off'}`} />
              {p.displayName}
              {p.isFacilitator && <span className="badge">facilitator</span>}
              {p.id === membership.participantId && <span className="you">you</span>}
            </li>
          ))}
        </ul>
      </section>

      <p className="hint">Stories and voting arrive next (STORY-005, STORY-006).</p>
    </main>
  );
}
