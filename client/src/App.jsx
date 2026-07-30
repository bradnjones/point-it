import { useEffect, useState } from 'react';
import Join from './pages/Join.jsx';
import Session from './pages/Session.jsx';
import { getSession } from './lib/api.js';
import { clearMembership, loadMembership, saveMembership } from './lib/storage.js';
import { disconnectSocket } from './lib/socket.js';

export default function App() {
  const [membership, setMembership] = useState(null);
  const [checking, setChecking] = useState(true);

  // Rehydrate after a refresh: keep the stored membership only if the session
  // still exists and this participant is still a member of it.
  useEffect(() => {
    const stored = loadMembership();
    if (!stored) {
      setChecking(false);
      return;
    }

    getSession(stored.code)
      .then(({ participants }) => {
        const stillMember = participants.some((p) => p.id === stored.participantId);
        if (stillMember) setMembership(stored);
        else clearMembership();
      })
      .catch(() => clearMembership())
      .finally(() => setChecking(false));
  }, []);

  function handleJoined(next) {
    saveMembership(next);
    setMembership(next);
  }

  function handleLeave() {
    disconnectSocket();
    clearMembership();
    setMembership(null);
  }

  if (checking) return <main className="loading">Loading…</main>;

  return membership ? (
    <Session membership={membership} onLeave={handleLeave} />
  ) : (
    <Join onJoined={handleJoined} />
  );
}
