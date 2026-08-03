import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { openDb } from '../db.js';

let db;
let app;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db, presence: { isConnected: () => false } });
});

afterEach(() => db.close());

describe('POST /api/sessions', () => {
  it('creates a session and returns a facilitator token once', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'Sprint 42', displayName: 'Brad' });

    expect(res.status).toBe(201);
    expect(res.body.session.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(res.body.participant).toMatchObject({ displayName: 'Brad', isFacilitator: true });
    expect(res.body.facilitatorToken).toEqual(expect.any(String));
    // The token hash must never be exposed in the session payload.
    expect(res.body.session.facilitator_token).toBeUndefined();
  });

  it('defaults to free_form and accepts pert', async () => {
    const free = await request(app).post('/api/sessions').send({ name: 'A', displayName: 'X' });
    const pert = await request(app)
      .post('/api/sessions')
      .send({ name: 'B', displayName: 'X', mode: 'pert' });

    expect(free.body.session.mode).toBe('free_form');
    expect(pert.body.session.mode).toBe('pert');
  });

  it('rejects a missing session or display name', async () => {
    expect((await request(app).post('/api/sessions').send({ displayName: 'X' })).status).toBe(400);
    expect((await request(app).post('/api/sessions').send({ name: 'A' })).status).toBe(400);
  });
});

describe('POST /api/sessions/:code/join', () => {
  it('adds a non-facilitator participant', async () => {
    const created = await request(app).post('/api/sessions').send({ name: 'S', displayName: 'Host' });
    const { code } = created.body.session;

    const res = await request(app).post(`/api/sessions/${code}/join`).send({ displayName: 'Guest' });

    expect(res.status).toBe(201);
    expect(res.body.participant).toMatchObject({ displayName: 'Guest', isFacilitator: false });
    expect(res.body.facilitatorToken).toBeUndefined();
  });

  it('is case-insensitive on the code', async () => {
    const created = await request(app).post('/api/sessions').send({ name: 'S', displayName: 'Host' });
    const code = created.body.session.code.toLowerCase();

    const res = await request(app).post(`/api/sessions/${code}/join`).send({ displayName: 'Guest' });
    expect(res.status).toBe(201);
  });

  it('404s an unknown code', async () => {
    const res = await request(app).post('/api/sessions/ZZZZZZ/join').send({ displayName: 'Guest' });
    expect(res.status).toBe(404);
  });

  it('410s a closed session', async () => {
    const created = await request(app).post('/api/sessions').send({ name: 'S', displayName: 'Host' });
    const { code } = created.body.session;
    db.prepare(`UPDATE sessions SET closed_at = 'now' WHERE code = ?`).run(code);

    const res = await request(app).post(`/api/sessions/${code}/join`).send({ displayName: 'Guest' });
    expect(res.status).toBe(410);
  });
});

describe('GET /api/sessions/:code', () => {
  it('returns session state for rehydration without leaking the token', async () => {
    const created = await request(app).post('/api/sessions').send({ name: 'S', displayName: 'Host' });
    const { code } = created.body.session;
    await request(app).post(`/api/sessions/${code}/join`).send({ displayName: 'Guest' });

    const res = await request(app).get(`/api/sessions/${code}`);

    expect(res.status).toBe(200);
    expect(res.body.participants).toHaveLength(2);
    expect(res.body.stories).toEqual([]);
    expect(res.body.session.activeStoryId).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('facilitator_token');
  });

  it('404s an unknown code', async () => {
    expect((await request(app).get('/api/sessions/ZZZZZZ')).status).toBe(404);
  });
});

describe('GET /api/sessions (history list)', () => {
  it('is empty and well-formed when there are no sessions', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sessions: [], total: 0, offset: 0 });
  });

  it('lists sessions newest-first with summary counts and status', async () => {
    const a = await request(app).post('/api/sessions').send({ name: 'Older', displayName: 'Host' });
    await request(app)
      .post(`/api/sessions/${a.body.session.code}/join`)
      .send({ displayName: 'Guest' });
    await request(app).post('/api/sessions').send({ name: 'Newer', displayName: 'Host' });

    const res = await request(app).get('/api/sessions');

    expect(res.body.total).toBe(2);
    expect(res.body.sessions.map((s) => s.name)).toEqual(['Newer', 'Older']);
    const older = res.body.sessions.find((s) => s.name === 'Older');
    expect(older).toMatchObject({ participantCount: 2, storyCount: 0, status: 'active' });
    expect(JSON.stringify(res.body)).not.toContain('facilitator_token');
  });

  it('marks a closed session and reports it in the list', async () => {
    const created = await request(app).post('/api/sessions').send({ name: 'S', displayName: 'Host' });
    db.prepare(`UPDATE sessions SET closed_at = 'now' WHERE code = ?`).run(created.body.session.code);

    const res = await request(app).get('/api/sessions');
    expect(res.body.sessions[0].status).toBe('closed');
  });

  it('pages via limit and offset', async () => {
    for (const name of ['A', 'B', 'C']) {
      await request(app).post('/api/sessions').send({ name, displayName: 'Host' });
    }

    const page1 = await request(app).get('/api/sessions?limit=2&offset=0');
    expect(page1.body.sessions.map((s) => s.name)).toEqual(['C', 'B']);
    expect(page1.body).toMatchObject({ total: 3, limit: 2, offset: 0 });

    const page2 = await request(app).get('/api/sessions?limit=2&offset=2');
    expect(page2.body.sessions.map((s) => s.name)).toEqual(['A']);
  });
});
