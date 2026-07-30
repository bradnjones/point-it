import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { openDb } from './db.js';
import { createPresence } from './services/presence.js';
import { registerSocketHandlers } from './sockets.js';
import { createSession } from './services/sessions.js';
import { addParticipant } from './services/participants.js';

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

describe('session:join', () => {
  it('acks with session + self, and rejects bad joins', async () => {
    const { session } = createSession(db, { name: 'S' });
    const p = addParticipant(db, session.id, { displayName: 'Alice', isFacilitator: true });

    const client = connect();
    const ack = await join(client, { code: session.code, participantId: p.id });

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
