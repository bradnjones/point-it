import { describe, expect, it } from 'vitest';
import { migrate, openDb } from './db.js';
import {
  createSession,
  getSessionByCode,
  getSessionById,
  listSessions,
  setActiveStory,
  verifyFacilitatorToken,
} from './services/sessions.js';
import { addParticipant, listParticipants } from './services/participants.js';
import { addStory, deleteStory, listStories, reorderStories, setFinalPoints } from './services/stories.js';
import { createRound, ensureRound, getCurrentRound, revealRound } from './services/rounds.js';
import { castVote, countVotes, listVoterIds, listVotes } from './services/votes.js';

const freshDb = () => openDb(':memory:');

describe('migrations', () => {
  it('are idempotent', () => {
    const db = freshDb(); // openDb already migrated once
    const secondRun = migrate(db);
    expect(secondRun).toEqual([]); // nothing new applied

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining(['sessions', 'participants', 'stories', 'rounds', 'votes'])
    );
  });

  it('enforces the vote uniqueness constraint', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const p = addParticipant(db, session.id, { displayName: 'A' });
    const story = addStory(db, session.id, { title: 'T' });
    const round = createRound(db, story.id);

    // castVote upserts, so two calls do not violate the constraint...
    castVote(db, { roundId: round.id, participantId: p.id, value: '3' });
    castVote(db, { roundId: round.id, participantId: p.id, value: '5' });
    expect(countVotes(db, round.id)).toBe(1);

    // ...but a raw duplicate insert must fail.
    expect(() =>
      db
        .prepare('INSERT INTO votes (round_id, participant_id, value) VALUES (?, ?, ?)')
        .run(round.id, p.id, '8')
    ).toThrow(/UNIQUE/);
  });
});

describe('sessions', () => {
  it('creates a session with a unique code and returns a facilitator token once', () => {
    const db = freshDb();
    const { session, facilitatorToken } = createSession(db, { name: 'Refine', mode: 'pert' });

    expect(session.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(session.mode).toBe('pert');
    expect(facilitatorToken).toHaveLength(48);
    // The plain token is never stored; only its hash is.
    expect(session.facilitator_token).not.toBe(facilitatorToken);
  });

  it('looks up by code case-insensitively', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    expect(getSessionByCode(db, session.code.toLowerCase())?.id).toBe(session.id);
  });

  it('verifies the facilitator token', () => {
    const db = freshDb();
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    expect(verifyFacilitatorToken(db, session.id, facilitatorToken)).toBe(true);
    expect(verifyFacilitatorToken(db, session.id, 'wrong')).toBe(false);
  });

  it('lists sessions with story and participant counts', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    addParticipant(db, session.id, { displayName: 'A' });
    addStory(db, session.id, { title: 'T1' });
    addStory(db, session.id, { title: 'T2' });

    const [row] = listSessions(db);
    expect(row).toMatchObject({ story_count: 2, participant_count: 1 });
  });
});

describe('stories (STORY-005)', () => {
  it('assigns incrementing positions and reorders within a session', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const a = addStory(db, session.id, { title: 'A' });
    const b = addStory(db, session.id, { title: 'B' });
    const c = addStory(db, session.id, { title: 'C' });
    expect([a.position, b.position, c.position]).toEqual([0, 1, 2]);

    const reordered = reorderStories(db, session.id, [c.id, a.id, b.id]);
    expect(reordered.map((s) => s.title)).toEqual(['C', 'A', 'B']);
  });

  it('only reorders stories that belong to the session', () => {
    const db = freshDb();
    const { session: s1 } = createSession(db, { name: 'S1' });
    const { session: s2 } = createSession(db, { name: 'S2' });
    const mine = addStory(db, s1.id, { title: 'Mine' });
    const other = addStory(db, s2.id, { title: 'Other' });

    // A spoofed id from another session is ignored, not moved.
    reorderStories(db, s1.id, [other.id, mine.id]);
    expect(listStories(db, s2.id)[0].position).toBe(0);
    expect(listStories(db, s1.id)[0].id).toBe(mine.id);
  });

  it('sets and clears the active story, rejecting foreign stories', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const { session: other } = createSession(db, { name: 'Other' });
    const story = addStory(db, session.id, { title: 'T' });
    const foreign = addStory(db, other.id, { title: 'F' });

    setActiveStory(db, session.id, story.id);
    expect(getSessionById(db, session.id).active_story_id).toBe(story.id);

    expect(() => setActiveStory(db, session.id, foreign.id)).toThrow(/does not belong/i);

    setActiveStory(db, session.id, null);
    expect(getSessionById(db, session.id).active_story_id).toBeNull();
  });

  it('clears the active pointer when the active story is deleted', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const story = addStory(db, session.id, { title: 'T' });
    setActiveStory(db, session.id, story.id);

    deleteStory(db, story.id);
    expect(getSessionById(db, session.id).active_story_id).toBeNull();
  });
});

describe('full session round-trip', () => {
  it('persists a session with stories, rounds, and votes and reads it back', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'Sprint 42' });
    const alice = addParticipant(db, session.id, { displayName: 'Alice', isFacilitator: true });
    const bob = addParticipant(db, session.id, { displayName: 'Bob' });
    const story = addStory(db, session.id, { title: 'Search', description: 'Full text' });

    const round = createRound(db, story.id);
    castVote(db, { roundId: round.id, participantId: alice.id, value: '5', reason: 'medium' });
    castVote(db, { roundId: round.id, participantId: bob.id, value: '8' });

    expect(listParticipants(db, session.id)).toHaveLength(2);
    expect(listStories(db, session.id)).toHaveLength(1);
    expect(getCurrentRound(db, story.id).id).toBe(round.id);

    const votes = listVotes(db, round.id);
    expect(votes).toHaveLength(2);
    expect(votes.find((v) => v.participant_id === alice.id).reason).toBe('medium');

    const finalized = setFinalPoints(db, story.id, '8');
    expect(finalized.final_points).toBe('8');
  });

  it('ensureRound opens round 1 once and then reuses it', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const story = addStory(db, session.id, { title: 'T' });

    const first = ensureRound(db, story.id);
    const second = ensureRound(db, story.id);
    expect(first.id).toBe(second.id);
    expect(first.round_number).toBe(1);
  });

  it('keeps prior rounds when re-voting', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const story = addStory(db, session.id, { title: 'T' });

    const r1 = createRound(db, story.id);
    revealRound(db, r1.id);
    const r2 = createRound(db, story.id);

    expect(r2.round_number).toBe(2);
    expect(getCurrentRound(db, story.id).id).toBe(r2.id);
  });
});

describe('votes support both estimation modes', () => {
  it('stores a free-form value', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const p = addParticipant(db, session.id, { displayName: 'A' });
    const round = createRound(db, addStory(db, session.id, { title: 'T' }).id);

    const vote = castVote(db, { roundId: round.id, participantId: p.id, value: '?' });
    expect(vote.value).toBe('?');
    expect(vote.pert_likely).toBeNull();
  });

  it('stores three PERT values', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S', mode: 'pert' });
    const p = addParticipant(db, session.id, { displayName: 'A' });
    const round = createRound(db, addStory(db, session.id, { title: 'T' }).id);

    const vote = castVote(db, {
      roundId: round.id,
      participantId: p.id,
      pert: { optimistic: 2, likely: 5, pessimistic: 10 },
    });
    expect(vote.value).toBeNull();
    expect([vote.pert_optimistic, vote.pert_likely, vote.pert_pessimistic]).toEqual([2, 5, 10]);
  });
});

describe('pre-reveal safe reads', () => {
  it('expose who voted and how many, without values', () => {
    const db = freshDb();
    const { session } = createSession(db, { name: 'S' });
    const a = addParticipant(db, session.id, { displayName: 'A' });
    const b = addParticipant(db, session.id, { displayName: 'B' });
    const round = createRound(db, addStory(db, session.id, { title: 'T' }).id);

    castVote(db, { roundId: round.id, participantId: a.id, value: '3' });
    castVote(db, { roundId: round.id, participantId: b.id, value: '5' });

    expect(countVotes(db, round.id)).toBe(2);
    expect(listVoterIds(db, round.id).sort()).toEqual([a.id, b.id].sort());
  });
});
