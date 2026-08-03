import { useEffect, useRef, useState } from 'react';
import { connectSocket, emitWithAck, socket } from '../lib/socket.js';
import StoriesPanel from '../components/StoriesPanel.jsx';
import VotePanel from '../components/VotePanel.jsx';
import RevealPanel from '../components/RevealPanel.jsx';

/**
 * The live session shell: session name, shareable code, participant list, story
 * backlog, and your private vote — all updating in real time.
 */
export default function Session({ membership, onLeave }) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [yourVote, setYourVote] = useState(null);
  const [voterIds, setVoterIds] = useState([]);
  const [reveal, setReveal] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);

  const isFacilitator = Boolean(membership.facilitatorToken);
  // Quick (ad-hoc) sessions estimate repeated rounds against one implicit story,
  // so they hide the backlog and story-specific controls entirely (STORY-019).
  const quick = session?.kind === 'quick';
  // Tracks the active story we last loaded a vote for, so a plain story-list
  // change (add/edit/reorder) doesn't needlessly clear the vote in progress.
  const activeStoryRef = useRef(null);
  // Tracks the current round so a re-vote (same story, new round) resets the
  // vote and reveal even though the active story hasn't changed.
  const roundRef = useRef(null);

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
          setYourVote(ack.yourVote ?? null);
          setVoterIds(ack.voterIds ?? []);
          setReveal(ack.reveal ?? null);
          activeStoryRef.current = ack.session?.activeStoryId ?? null;
          roundRef.current = ack.roundId ?? null;
        }
      );
    };

    const onParticipants = ({ participants }) => setParticipants(participants);
    const onVoting = ({ roundId, voterIds }) => {
      setVoterIds(voterIds ?? []);
      const next = roundId ?? null;
      // A re-vote keeps the active story but opens a new round: clear the vote
      // and reveal, then reload your (empty) vote for the new round. Guarded on
      // a previously-known non-null round so the first observation after joining
      // or activating a story doesn't wipe a freshly-seeded vote.
      if (next !== roundRef.current && roundRef.current !== null && next !== null) {
        setYourVote(null);
        setReveal(null);
        emitWithAck('vote:mine')
          .then(({ vote }) => setYourVote(vote ?? null))
          .catch(() => {});
      }
      roundRef.current = next;
    };
    const onReveal = ({ reveal }) => setReveal(reveal ?? null);
    const onClosed = ({ closedAt }) =>
      setSession((prev) => (prev ? { ...prev, closedAt } : prev));
    const onStories = ({ stories, activeStoryId }) => {
      setStories(stories);
      const next = activeStoryId ?? null;
      setActiveStoryId(next);

      // Only the active story changing affects your vote. Clear immediately to
      // avoid flashing the previous story's vote, then load your vote (if any)
      // for the new round.
      if (next !== activeStoryRef.current) {
        activeStoryRef.current = next;
        setYourVote(null);
        setReveal(null);
        if (next) {
          emitWithAck('vote:mine')
            .then(({ vote }) => setYourVote(vote ?? null))
            .catch(() => {});
        }
      }
    };

    socket.on('connect', doJoin);
    socket.on('session:participants', onParticipants);
    socket.on('session:stories', onStories);
    socket.on('session:voting', onVoting);
    socket.on('session:reveal', onReveal);
    socket.on('session:closed', onClosed);
    if (socket.connected) doJoin();

    return () => {
      socket.off('connect', doJoin);
      socket.off('session:participants', onParticipants);
      socket.off('session:stories', onStories);
      socket.off('session:voting', onVoting);
      socket.off('session:reveal', onReveal);
      socket.off('session:closed', onClosed);
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

  async function castVote(value, reason) {
    const { vote } = await emitWithAck('vote:cast', { value, reason });
    setYourVote(vote);
  }

  // These broadcast their result to everyone (including the facilitator), so
  // they just fire the action; the ack is ignored in favour of the broadcast.
  const revealVotes = () => emitWithAck('vote:reveal');
  const reVote = () => emitWithAck('vote:revote');
  const finalize = (storyId, points) => emitWithAck('story:finalize', { storyId, points });
  const closeSession = () => emitWithAck('session:close').catch(() => {});

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(membership.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the code is shown regardless.
    }
  }

  const voted = new Set(voterIds);

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
        <div className="session-header-actions">
          {isFacilitator && !session?.closedAt && (
            <button type="button" className="link" onClick={closeSession}>
              Close session
            </button>
          )}
          <button type="button" className="link" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      {session?.closedAt && (
        <p className="closed-banner">This session has been closed.</p>
      )}

      <section className="panel">
        <h2>
          Participants ({participants.length})
          {activeStoryId && (
            <span className="vote-progress">
              {participants.filter((p) => voted.has(p.id)).length} of {participants.length} voted
            </span>
          )}
        </h2>
        <ul className="participants">
          {participants.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              <span className={`dot ${p.connected ? 'on' : 'off'}`} />
              {p.displayName}
              {p.isFacilitator && <span className="badge">facilitator</span>}
              {p.id === membership.participantId && <span className="you">you</span>}
              {activeStoryId &&
                (voted.has(p.id) ? (
                  <span className="voted">✓ voted</span>
                ) : (
                  <span className="awaiting">…</span>
                ))}
            </li>
          ))}
        </ul>
      </section>

      <VotePanel
        activeStory={stories.find((s) => s.id === activeStoryId) ?? null}
        scale={session?.scale ? session.scale.split(',') : []}
        yourVote={yourVote}
        onCast={castVote}
        isFacilitator={isFacilitator}
        revealed={Boolean(reveal)}
        onReveal={revealVotes}
        quick={quick}
      />

      <RevealPanel
        reveal={reveal}
        isFacilitator={isFacilitator}
        onRevote={reVote}
        onFinalize={finalize}
        quick={quick}
      />

      {!quick && (
        <StoriesPanel
          stories={stories}
          activeStoryId={activeStoryId}
          isFacilitator={isFacilitator}
          {...storyActions}
        />
      )}
    </main>
  );
}
