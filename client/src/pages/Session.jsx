import { useEffect, useState } from 'react';
import { connectSocket, emitWithAck, socket } from '../lib/socket.js';
import StoriesPanel from '../components/StoriesPanel.jsx';

/**
 * The live session shell: session name, shareable code, a participant list, and
 * the story backlog — all updating in real time. Voting arrives in STORY-006.
 */
export default function Session({ membership, onLeave }) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);

  const isFacilitator = Boolean(membership.facilitatorToken);

  useEffect(() => {
    connectSocket();

    const doJoin = () => {
      socket.emit(
        'session:join',
        {
          code: membership.code,
          participantId: membership.participantId,
          facilitatorToken: membership.facilitatorToken,
        },
        (ack) => {
          if (ack?.error) return setJoinError(ack.error);
          setSession(ack.session);
          setStories(ack.stories ?? []);
          setActiveStoryId(ack.session?.activeStoryId ?? null);
        }
      );
    };

    const onParticipants = ({ participants }) => setParticipants(participants);
    const onStories = ({ stories, activeStoryId }) => {
      setStories(stories);
      setActiveStoryId(activeStoryId ?? null);
    };

    socket.on('connect', doJoin);
    socket.on('session:participants', onParticipants);
    socket.on('session:stories', onStories);
    if (socket.connected) doJoin();

    return () => {
      socket.off('connect', doJoin);
      socket.off('session:participants', onParticipants);
      socket.off('session:stories', onStories);
    };
  }, [membership.code, membership.participantId, membership.facilitatorToken]);

  // Story mutations go over the socket; the server broadcasts the new list
  // back via `session:stories`, so these don't update local state directly.
  const storyActions = {
    onAdd: (title, description) => emitWithAck('story:add', { title, description }),
    onUpdate: (storyId, fields) => emitWithAck('story:update', { storyId, ...fields }),
    onDelete: (storyId) => emitWithAck('story:delete', { storyId }),
    onReorder: (orderedIds) => emitWithAck('story:reorder', { orderedIds }),
    onSetActive: (storyId) => emitWithAck('story:setActive', { storyId }),
  };

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

      <StoriesPanel
        stories={stories}
        activeStoryId={activeStoryId}
        isFacilitator={isFacilitator}
        {...storyActions}
      />

      <p className="hint">Voting arrives next (STORY-006).</p>
    </main>
  );
}
