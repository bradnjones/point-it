import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { openDb } from './db.js';
import { createPresence } from './services/presence.js';
import { registerSocketHandlers } from './sockets.js';
import { createSession, getSessionById } from './services/sessions.js';
import { addParticipant } from './services/participants.js';
import { listStories } from './services/stories.js';
import { getCurrentRound, isRevealed } from './services/rounds.js';
import { countVotes, getVote } from './services/votes.js';

let db;
let server;
let io;
let url;
const clients = [];

beforeEach(async () => {
  db = openDb(':memory:');
  server = http.createServer();
  io = new Server(server);
  registerSocketHandlers(io, db, createPresence());

  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  io.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

function connect() {
  const client = ioClient(url, { transports: ['websocket'], forceNew: true });
  clients.push(client);
  return client;
}

const join = (client, payload) =>
  new Promise((resolve) => client.emit('session:join', payload, resolve));

/**
 * Resolves on the first participants broadcast that satisfies `predicate`.
 * Presence updates can arrive in several steps (a member is in the DB before
 * their socket connects), so tests wait for the specific state they care about
 * rather than assuming the next event is the relevant one.
 */
const waitForParticipants = (client, predicate) =>
  new Promise((resolve) => {
    const handler = ({ participants }) => {
      if (predicate(participants)) {
        client.off('session:participants', handler);
        resolve(participants);
      }
    };
    client.on('session:participants', handler);
  });

const emit = (client, event, payload) =>
  new Promise((resolve) => client.emit(event, payload, resolve));

const waitForStories = (client, predicate = () => true) =>
  new Promise((resolve) => {
    const handler = (payload) => {
      if (predicate(payload)) {
        client.off('session:stories', handler);
        resolve(payload);
      }
    };
    client.on('session:stories', handler);
  });

const waitForVoting = (client, predicate = () => true) =>
  new Promise((resolve) => {
    const handler = (payload) => {
      if (predicate(payload)) {
        client.off('session:voting', handler);
        resolve(payload);
      }
    };
    client.on('session:voting', handler);
  });

const waitForReveal = (client, predicate = () => true) =>
  new Promise((resolve) => {
    const handler = (payload) => {
      if (predicate(payload)) {
        client.off('session:reveal', handler);
        resolve(payload);
      }
    };
    client.on('session:reveal', handler);
  });

describe('session:join', () => {
  it('acks with session + self, and rejects bad joins', async () => {
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    const p = addParticipant(db, session.id, { displayName: 'Alice', isFacilitator: true });

    const client = connect();
    const ack = await join(client, { code: session.code, participantId: p.id, facilitatorToken });

    expect(ack.session).toMatchObject({ code: session.code, name: 'S' });
    expect(ack.you).toMatchObject({ displayName: 'Alice', isFacilitator: true, connected: true });

    const bad = await join(connect(), { code: 'ZZZZZZ', participantId: p.id });
    expect(bad.error).toBeTruthy();

    const wrongMember = await join(connect(), { code: session.code, participantId: 99999 });
    expect(wrongMember.error).toBeTruthy();
  });

  it('broadcasts presence when a second member joins and when one leaves', async () => {
    const { session } = createSession(db, { name: 'S' });
    const alice = addParticipant(db, session.id, { displayName: 'Alice', isFacilitator: true });
    const bob = addParticipant(db, session.id, { displayName: 'Bob' });

    const aliceClient = connect();
    await join(aliceClient, { code: session.code, participantId: alice.id });

    // Alice sees both connected once Bob's socket joins.
    const bothConnected = waitForParticipants(aliceClient, (ps) => ps.every((p) => p.connected));
    const bobClient = connect();
    await join(bobClient, { code: session.code, participantId: bob.id });

    const participants = await bothConnected;
    expect(participants).toHaveLength(2);

    // When Bob disconnects, Alice sees him as not connected while she stays on.
    const bobOffline = waitForParticipants(
      aliceClient,
      (ps) => ps.find((p) => p.id === bob.id)?.connected === false
    );
    bobClient.close();

    const after = await bobOffline;
    expect(after.find((p) => p.id === alice.id).connected).toBe(true);
  });
});

describe('story events', () => {
  // Sets up a facilitator (with token) and a plain member, both joined.
  async function setup() {
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    const fac = addParticipant(db, session.id, { displayName: 'Facilitator', isFacilitator: true });
    const member = addParticipant(db, session.id, { displayName: 'Member' });

    const facClient = connect();
    const facAck = await join(facClient, {
      code: session.code,
      participantId: fac.id,
      facilitatorToken,
    });
    const memberClient = connect();
    await join(memberClient, { code: session.code, participantId: member.id });

    return { session, facilitatorToken, fac, member, facClient, memberClient, facAck };
  }

  it('lets the facilitator add a story and broadcasts it to everyone', async () => {
    const { facClient, memberClient, facAck } = await setup();
    expect(facAck.you.isFacilitator).toBe(true);
    expect(facAck.stories).toEqual([]);

    const seen = waitForStories(memberClient, (p) => p.stories.length === 1);
    const ack = await emit(facClient, 'story:add', { title: 'Search', description: 'Full text' });

    expect(ack.story).toMatchObject({ title: 'Search', description: 'Full text' });
    const { stories } = await seen;
    expect(stories[0]).toMatchObject({ title: 'Search' });
  });

  it('rejects mutations from a non-facilitator', async () => {
    const { session, memberClient } = await setup();

    const ack = await emit(memberClient, 'story:add', { title: 'Sneaky' });
    expect(ack.error).toMatch(/facilitator/i);
    expect(listStories(db, session.id)).toEqual([]);
  });

  it('requires a non-empty title', async () => {
    const { facClient } = await setup();
    const ack = await emit(facClient, 'story:add', { title: '   ' });
    expect(ack.error).toMatch(/title is required/i);
  });

  it('edits and deletes a story, broadcasting each change', async () => {
    const { session, facClient, memberClient } = await setup();
    const { story } = await emit(facClient, 'story:add', { title: 'Old' });

    const edited = waitForStories(memberClient, (p) => p.stories[0]?.title === 'New');
    await emit(facClient, 'story:update', { storyId: story.id, title: 'New' });
    await edited;

    const emptied = waitForStories(memberClient, (p) => p.stories.length === 0);
    await emit(facClient, 'story:delete', { storyId: story.id });
    await emptied;

    expect(listStories(db, session.id)).toEqual([]);
  });

  it('sets the active story and clears it when that story is deleted', async () => {
    const { session, facClient, memberClient } = await setup();
    await emit(facClient, 'story:add', { title: 'A' });
    const b = await emit(facClient, 'story:add', { title: 'B' });

    const activated = waitForStories(memberClient, (p) => p.activeStoryId === b.story.id);
    await emit(facClient, 'story:setActive', { storyId: b.story.id });
    await activated;
    expect(getSessionById(db, session.id).active_story_id).toBe(b.story.id);

    // Deleting the active story clears the pointer for everyone.
    const cleared = waitForStories(memberClient, (p) => p.activeStoryId === null);
    await emit(facClient, 'story:delete', { storyId: b.story.id });
    const { stories } = await cleared;
    expect(stories.map((s) => s.title)).toEqual(['A']);
    expect(getSessionById(db, session.id).active_story_id).toBeNull();
  });

  it('reorders stories and broadcasts the new order', async () => {
    const { facClient, memberClient } = await setup();
    const a = await emit(facClient, 'story:add', { title: 'A' });
    const b = await emit(facClient, 'story:add', { title: 'B' });
    const c = await emit(facClient, 'story:add', { title: 'C' });

    const reordered = waitForStories(
      memberClient,
      (p) => p.stories.map((s) => s.title).join('') === 'CAB'
    );
    await emit(facClient, 'story:reorder', { orderedIds: [c.story.id, a.story.id, b.story.id] });
    const { stories } = await reordered;
    expect(stories.map((s) => s.title)).toEqual(['C', 'A', 'B']);
  });
});

describe('vote events', () => {
  // A facilitator plus two voters, with a story added and set active (which
  // opens the round they vote against).
  async function setup() {
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    const fac = addParticipant(db, session.id, { displayName: 'Fac', isFacilitator: true });
    const alice = addParticipant(db, session.id, { displayName: 'Alice' });
    const bob = addParticipant(db, session.id, { displayName: 'Bob' });

    const facClient = connect();
    await join(facClient, { code: session.code, participantId: fac.id, facilitatorToken });
    const aliceClient = connect();
    await join(aliceClient, { code: session.code, participantId: alice.id });
    const bobClient = connect();
    await join(bobClient, { code: session.code, participantId: bob.id });

    const { story } = await emit(facClient, 'story:add', { title: 'A' });
    await emit(facClient, 'story:setActive', { storyId: story.id });

    return { session, fac, alice, bob, facClient, aliceClient, bobClient, story };
  }

  it('opens a round when a story becomes active', async () => {
    const { story } = await setup();
    expect(getCurrentRound(db, story.id)).toBeTruthy();
  });

  it('records a vote and acks the caller their own value and reason', async () => {
    const { aliceClient, alice, story } = await setup();

    const ack = await emit(aliceClient, 'vote:cast', { value: '5', reason: 'medium' });
    expect(ack.vote).toMatchObject({ value: '5', reason: 'medium' });

    const round = getCurrentRound(db, story.id);
    expect(getVote(db, round.id, alice.id).reason).toBe('medium');
  });

  it('updates the existing vote on re-submit rather than duplicating', async () => {
    const { aliceClient, alice, story } = await setup();

    await emit(aliceClient, 'vote:cast', { value: '3' });
    await emit(aliceClient, 'vote:cast', { value: '8' });

    const round = getCurrentRound(db, story.id);
    expect(getVote(db, round.id, alice.id).value).toBe('8');
    expect(countVotes(db, round.id)).toBe(1);
  });

  it('rejects a value that is not on the session scale', async () => {
    const { aliceClient } = await setup();
    const ack = await emit(aliceClient, 'vote:cast', { value: '99' });
    expect(ack.error).toMatch(/scale/i);
  });

  it('rejects voting when no story is being estimated', async () => {
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    const p = addParticipant(db, session.id, { displayName: 'A', isFacilitator: true });
    const client = connect();
    await join(client, { code: session.code, participantId: p.id, facilitatorToken });

    const ack = await emit(client, 'vote:cast', { value: '5' });
    expect(ack.error).toMatch(/no story/i);
  });

  it('never exposes another participant\'s value before reveal', async () => {
    const { aliceClient, bobClient } = await setup();

    // Record every event Bob receives after he starts listening.
    const received = [];
    bobClient.onAny((event, payload) => received.push({ event, payload }));

    await emit(aliceClient, 'vote:cast', { value: '13', reason: 'gut feel' });

    // Bob's own-vote channel shows nothing (he hasn't voted)...
    const mine = await emit(bobClient, 'vote:mine');
    expect(mine.vote).toBeNull();

    // ...and no broadcast carried Alice's value or reason to him.
    await new Promise((resolve) => setTimeout(resolve, 40));
    const seen = JSON.stringify(received);
    expect(seen).not.toContain('13');
    expect(seen).not.toContain('gut feel');
  });

  it('presents a fresh, empty vote when the active story switches', async () => {
    const { aliceClient, facClient } = await setup();

    await emit(aliceClient, 'vote:cast', { value: '5' });
    expect((await emit(aliceClient, 'vote:mine')).vote).toMatchObject({ value: '5' });

    const { story: storyB } = await emit(facClient, 'story:add', { title: 'B' });
    await emit(facClient, 'story:setActive', { storyId: storyB.id });

    expect((await emit(aliceClient, 'vote:mine')).vote).toBeNull();
  });

  it('seeds your own vote into the join ack for reconnect', async () => {
    const { session, alice, aliceClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '8' });

    // A fresh socket for the same participant (a reconnect/refresh) is handed
    // back its own vote immediately.
    const reconnect = connect();
    const ack = await join(reconnect, { code: session.code, participantId: alice.id });
    expect(ack.yourVote).toMatchObject({ value: '8' });
  });
});

describe('voting presence (STORY-007)', () => {
  async function setup() {
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    const fac = addParticipant(db, session.id, { displayName: 'Fac', isFacilitator: true });
    const alice = addParticipant(db, session.id, { displayName: 'Alice' });
    const bob = addParticipant(db, session.id, { displayName: 'Bob' });

    const facClient = connect();
    await join(facClient, { code: session.code, participantId: fac.id, facilitatorToken });
    const aliceClient = connect();
    await join(aliceClient, { code: session.code, participantId: alice.id });
    const bobClient = connect();
    await join(bobClient, { code: session.code, participantId: bob.id });

    const { story } = await emit(facClient, 'story:add', { title: 'A' });
    await emit(facClient, 'story:setActive', { storyId: story.id });

    return { session, fac, alice, bob, facClient, aliceClient, bobClient, story };
  }

  it('tells the room who has voted — ids only, never the value', async () => {
    const { alice, aliceClient, bobClient } = await setup();

    const seen = waitForVoting(bobClient, (p) => p.voterIds.includes(alice.id));
    await emit(aliceClient, 'vote:cast', { value: '13', reason: 'anchoring risk' });

    const payload = await seen;
    expect(payload.voterIds).toEqual([alice.id]);
    const asText = JSON.stringify(payload);
    expect(asText).not.toContain('13');
    expect(asText).not.toContain('anchoring risk');
  });

  it('resets the voter list when the active story switches', async () => {
    const { alice, aliceClient, facClient, bobClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '5' });

    const reset = waitForVoting(
      bobClient,
      (p) => p.voterIds.length === 0 && !p.voterIds.includes(alice.id)
    );
    const { story: storyB } = await emit(facClient, 'story:add', { title: 'B' });
    await emit(facClient, 'story:setActive', { storyId: storyB.id });

    const payload = await reset;
    expect(payload.voterIds).toEqual([]);
  });

  it('seeds the current voter list into the join ack', async () => {
    const { session, alice, aliceClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '3' });

    const bob2 = addParticipant(db, session.id, { displayName: 'Bob2' });
    const ack = await join(connect(), { code: session.code, participantId: bob2.id });
    expect(ack.voterIds).toEqual([alice.id]);
  });
});

describe('reveal (STORY-008)', () => {
  async function setup() {
    const { session, facilitatorToken } = createSession(db, { name: 'S' });
    const fac = addParticipant(db, session.id, { displayName: 'Fac', isFacilitator: true });
    const alice = addParticipant(db, session.id, { displayName: 'Alice' });
    const bob = addParticipant(db, session.id, { displayName: 'Bob' });

    const facClient = connect();
    await join(facClient, { code: session.code, participantId: fac.id, facilitatorToken });
    const aliceClient = connect();
    await join(aliceClient, { code: session.code, participantId: alice.id });
    const bobClient = connect();
    await join(bobClient, { code: session.code, participantId: bob.id });

    const { story } = await emit(facClient, 'story:add', { title: 'A' });
    await emit(facClient, 'story:setActive', { storyId: story.id });

    return { session, fac, alice, bob, facClient, aliceClient, bobClient, story };
  }

  it('reveals every vote and reason to the whole room with stats', async () => {
    const { alice, bob, facClient, aliceClient, bobClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '3', reason: 'small' });
    await emit(bobClient, 'vote:cast', { value: '8', reason: 'risky' });

    const seen = waitForReveal(bobClient, (p) => p.reveal !== null);
    const ack = await emit(facClient, 'vote:reveal');

    const payload = await seen;
    expect(ack.reveal.stats).toMatchObject({ min: 3, max: 8, spread: 5, consensus: false });
    expect(payload.reveal.votes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ participantId: alice.id, value: '3', reason: 'small' }),
        expect.objectContaining({ participantId: bob.id, value: '8', reason: 'risky' }),
      ])
    );
    expect(payload.reveal.stats.average).toBe(5.5);
  });

  it('rejects a reveal from a non-facilitator', async () => {
    const { aliceClient, story } = await setup();
    const ack = await emit(aliceClient, 'vote:reveal');
    expect(ack.error).toMatch(/facilitator/i);
    expect(isRevealed(db, getCurrentRound(db, story.id).id)).toBe(false);
  });

  it('locks voting once revealed', async () => {
    const { facClient, aliceClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '5' });
    await emit(facClient, 'vote:reveal');

    const ack = await emit(aliceClient, 'vote:cast', { value: '8' });
    expect(ack.error).toMatch(/closed/i);
  });

  it('seeds the reveal into a late joiner’s ack, and is null before reveal', async () => {
    const { session, aliceClient, facClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '5', reason: 'seen' });

    const early = addParticipant(db, session.id, { displayName: 'Early' });
    const earlyAck = await join(connect(), { code: session.code, participantId: early.id });
    expect(earlyAck.reveal).toBeNull();

    await emit(facClient, 'vote:reveal');

    const late = addParticipant(db, session.id, { displayName: 'Late' });
    const lateAck = await join(connect(), { code: session.code, participantId: late.id });
    expect(lateAck.reveal.votes.some((v) => v.value === '5' && v.reason === 'seen')).toBe(true);
  });

  it('clears the reveal when the active story switches', async () => {
    const { facClient, aliceClient, bobClient } = await setup();
    await emit(aliceClient, 'vote:cast', { value: '5' });
    await emit(facClient, 'vote:reveal');

    const cleared = waitForReveal(bobClient, (p) => p.reveal === null);
    const { story: storyB } = await emit(facClient, 'story:add', { title: 'B' });
    await emit(facClient, 'story:setActive', { storyId: storyB.id });
    await cleared;
  });
});
