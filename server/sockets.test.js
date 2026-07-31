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
