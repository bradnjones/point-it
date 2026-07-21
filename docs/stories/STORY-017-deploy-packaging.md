---
id: STORY-017
title: Deployment packaging
epic: F Polish
status: not-started
depends_on: [STORY-008]
commit_prefix: story-017
---

## Goal

Make the app trivially deployable when the team decides where to host it
(hosting choice was deliberately deferred).

## Scope

- Production build: client builds to static assets served by the Node process.
- `Dockerfile` (+ `.dockerignore`) producing a single runnable image; SQLite file
  on a mounted volume.
- `docs/DEPLOY.md`: run locally, run via Docker, required env vars, and notes for
  one small-VM/PaaS option (e.g. Fly.io or Render).
- Basic production hardening: env-driven port, health check, sane logging.

## Acceptance criteria

- `docker build` + `docker run` serves the full app on one port with a persistent
  DB volume.
- A fresh machine can run it from `docs/DEPLOY.md` alone.

## Notes

Only the packaging is in scope now; the actual hosting target is chosen later.
Because the server already serves the SPA (STORY-001), this stays small.
