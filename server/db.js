import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Default DB location, resolved relative to this file so it is the same
// wherever the process is launched from. A relative DATABASE_PATH is resolved
// against the current directory; an absolute one is used as-is.
export const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'point-it.db');

export function resolveDbPath() {
  const configured = process.env.DATABASE_PATH;
  if (!configured) return DEFAULT_DB_PATH;
  if (configured === ':memory:' || path.isAbsolute(configured)) return configured;
  return path.resolve(configured);
}

/**
 * Applies any migrations not yet recorded in the `migrations` table, each in a
 * transaction, in filename order. Forward-only and idempotent: re-running
 * applies nothing.
 */
export function migrate(db, migrationsDir = MIGRATIONS_DIR) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const applied = new Set(db.prepare('SELECT name FROM migrations').all().map((r) => r.name));
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const record = db.prepare('INSERT INTO migrations (name) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      record.run(file);
    })();
  }

  return files.filter((f) => !applied.has(f));
}

/**
 * Opens a SQLite connection with sane pragmas and migrations applied. Pass
 * ':memory:' for tests.
 */
export function openDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

let singleton = null;

/** Shared connection for the running server, keyed off DATABASE_PATH. */
export function getDb() {
  if (!singleton) {
    singleton = openDb(resolveDbPath());
  }
  return singleton;
}
