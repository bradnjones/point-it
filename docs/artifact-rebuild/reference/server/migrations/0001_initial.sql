-- Initial schema for point-it. See docs/PLAN.md ("Data model").
-- Timestamps are ISO-8601 UTC strings. Money-less app, so integer PKs are fine;
-- sessions carry a separate human-shareable `code`.

CREATE TABLE sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  mode              TEXT NOT NULL DEFAULT 'free_form'
                      CHECK (mode IN ('free_form', 'pert')),
  scale             TEXT NOT NULL DEFAULT '1,2,3,5,8,13,21,?',
  facilitator_token TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  closed_at         TEXT
);

CREATE TABLE participants (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  is_facilitator INTEGER NOT NULL DEFAULT 0 CHECK (is_facilitator IN (0, 1)),
  joined_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE stories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  external_ref TEXT,          -- GitLab work item URL/IID (STORY-015), nullable
  final_points TEXT,          -- agreed estimate once finalized (STORY-009)
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rounds (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id     INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  revealed_at  TEXT,          -- null until the facilitator reveals (STORY-008)
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (story_id, round_number)
);

-- A vote row holds EITHER a free-form value OR the three PERT values, so PERT
-- (STORY-012) needs no schema change. `value` is TEXT because the free-form
-- scale includes non-numeric entries like '?'.
CREATE TABLE votes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id         INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  participant_id   INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  value            TEXT,      -- free-form estimate
  pert_optimistic  REAL,      -- PERT: O
  pert_likely      REAL,      -- PERT: M
  pert_pessimistic REAL,      -- PERT: P
  reason           TEXT,      -- optional, both modes
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (round_id, participant_id)
);

CREATE INDEX idx_participants_session ON participants(session_id);
CREATE INDEX idx_stories_session ON stories(session_id);
CREATE INDEX idx_rounds_story ON rounds(story_id);
CREATE INDEX idx_votes_round ON votes(round_id);
