#!/usr/bin/env node
/**
 * Drops and recreates the local database, then optionally seeds a demo session.
 *   node server/scripts/reset-db.js          # empty, migrated DB
 *   node server/scripts/reset-db.js --seed   # + a demo session with stories
 */
import 'dotenv/config';
import fs from 'node:fs';
import { openDb, resolveDbPath } from '../db.js';
import { createSession } from '../services/sessions.js';
import { addParticipant } from '../services/participants.js';
import { addStory } from '../services/stories.js';

const dbPath = resolveDbPath();

if (dbPath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
}

const db = openDb(dbPath);
console.log(`[reset-db] recreated ${dbPath}`);

if (process.argv.includes('--seed')) {
  const { session, facilitatorToken } = createSession(db, { name: 'Demo refinement' });
  addParticipant(db, session.id, { displayName: 'Facilitator', isFacilitator: true });
  addStory(db, session.id, { title: 'Add login page', description: 'Email + password.' });
  addStory(db, session.id, { title: 'Export report as CSV' });
  console.log(`[reset-db] seeded session ${session.code} (facilitator token: ${facilitatorToken})`);
}

db.close();
