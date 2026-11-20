import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { openDb } from '../db.js';
import { getSessionByCode } from '../services/sessions.js';
import { listStories } from '../services/stories.js';
import { getCurrentRound } from '../services/rounds.js';

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

  it('rejects a missing session name', async () => {
    expect((await request(app).post('/api/sessions').send({ displayName: 'X' })).status).toBe(400);
  });

  it('auto-assigns a display name when none is given', async () => {
    const res = await request(app).post('/api/sessions').send({ name: 'A' });
    expect(res.status).toBe(201);
    expect(res.body.participant.displayName).toEqual(expect.any(String));
    expect(res.body.participant.displayName.length).toBeGreaterThan(0);
  });

  it('defaults to a stories session', async () => {
    const res = await request(app).post('/api/sessions').send({ name: 'A', displayName: 'X' });
    expect(res.body.session.kind).toBe('stories');
    expect(res.body.session.activeStoryId).toBeNull();
  });

  it('defaults to the Fibonacci scale with no time mapping', async () => {
    const res = await request(app).post('/api/sessions').send({ name: 'A', displayName: 'X' });
    expect(res.body.session.scale).toBe('1,2,3,5,8,13,21,?');
    expect(res.body.session.hoursPerPoint).toBeNull();
  });

  it('accepts a custom scale and hours-per-point', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Hourly',
        displayName: 'X',
        scale: '1,2,3,4,5,6,7,8,9,10',
        hoursPerPoint: 2,
      });
    expect(res.body.session.scale).toBe('1,2,3,4,5,6,7,8,9,10');
    expect(res.body.session.hoursPerPoint).toBe(2);
  });

  it('normalizes a scale: trims, drops blanks, de-dupes, keeps order', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'A', displayName: 'X', scale: ' 3 , 1 ,3, , 2 ' });
    expect(res.body.session.scale).toBe('3,1,2');
  });

  it('rejects an unusable scale or a bad hours-per-point', async () => {
    const oneValue = await request(app)
      .post('/api/sessions')
      .send({ name: 'A', displayName: 'X', scale: '5' });
    expect(oneValue.status).toBe(400);

    const badHours = await request(app)
      .post('/api/sessions')
      .send({ name: 'A', displayName: 'X', hoursPerPoint: -2 });
    expect(badHours.status).toBe(400);

    const nonNumericHours = await request(app)
      .post('/api/sessions')
      .send({ name: 'A', displayName: 'X', hoursPerPoint: 'soon' });
    expect(nonNumericHours.status).toBe(400);
  });

  it('provisions a quick session with an active implicit story and open round', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'Ad-hoc', displayName: 'Brad', kind: 'quick' });

    expect(res.status).toBe(201);
    expect(res.body.session.kind).toBe('quick');
    // The implicit story is active immediately so members can vote on join.
    expect(res.body.session.activeStoryId).toEqual(expect.any(Number));

    const session = getSessionByCode(db, res.body.session.code);
    const stories = listStories(db, session.id);
    expect(stories).toHaveLength(1);
    expect(session.active_story_id).toBe(stories[0].id);
    expect(getCurrentRound(db, stories[0].id)).not.toBeNull();
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

  it('auto-assigns a display name to a joiner who gives none', async () => {
    const created = await request(app).post('/api/sessions').send({ name: 'S', displayName: 'Host' });
    const { code } = created.body.session;

    const res = await request(app).post(`/api/sessions/${code}/join`).send({});

    expect(res.status).toBe(201);
    expect(res.body.participant.displayName).toEqual(expect.any(String));
    expect(res.body.participant.displayName.length).toBeGreaterThan(0);
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
