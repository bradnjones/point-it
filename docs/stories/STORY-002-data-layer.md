---
id: STORY-002
title: SQLite data layer & migrations
epic: A Foundations
status: done
depends_on: [STORY-001]
commit_prefix: story-002
---

## Goal

Provide the persistence layer all features build on, with a migration system so
the schema is versioned in code (source of truth in the repo).

## Scope

- `server/db.js`: `better-sqlite3` connection; DB path from env, defaults to
  `./data/point-it.db`.
- Migration runner (simple, forward-only, tracked in a `migrations` table) and
  the initial migration creating: `sessions`, `participants`, `stories`,
  `rounds`, `votes` (see data model in `docs/PLAN.md`).
- A thin repository module per table in `server/services/` exposing typed CRUD
  helpers used elsewhere (no raw SQL leaking into routes/sockets).
- Seed/reset script for local dev.

## Acceptance criteria

- Running the app creates the DB and applies migrations idempotently.
- Unit tests cover: migration is idempotent; a session with stories, rounds, and
  votes can be created and read back; the `(round_id, participant_id)` uniqueness
  constraint is enforced.
- Votes support both free-form (`value`) and PERT
  (`pert_optimistic`/`pert_likely`/`pert_pessimistic`) columns.

## Notes

Design the vote row to hold either free-form or PERT values so STORY-012 needs no
schema change — only new write/read paths.
