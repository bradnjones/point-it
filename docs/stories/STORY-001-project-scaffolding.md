---
id: STORY-001
title: Project scaffolding & dev workflow
epic: A Foundations
status: not-started
depends_on: []
commit_prefix: story-001
---

## Goal

Stand up the monorepo so any subsequent story has a place to land: Node/Express
server, React/Vite client, shared scripts, test runner, and a one-command dev
loop.

## Scope

- Root `package.json` with npm workspaces for `server/` and `client/`.
- `server/`: Express app, health route, Socket.IO wired up (no domain events
  yet), serves the built client in production.
- `client/`: Vite + React app with a placeholder Join page and a socket client
  wrapper (`src/lib/socket.js`).
- Test framework (Vitest) configured for both workspaces; one trivial passing
  test each.
- Linting/formatting (ESLint + Prettier) with an `npm run lint`.
- `.gitignore`, `.env.example`, and root scripts: `dev` (server + client
  concurrently), `build`, `test`, `lint`.

## Acceptance criteria

- `npm install` at root installs both workspaces.
- `npm run dev` serves the client and the API; the placeholder page loads and
  the browser console shows a successful Socket.IO connection.
- `npm test` and `npm run lint` pass.
- `.env.example` documents every env var the project will use (GitLab PAT, port).

## Notes

Keep the server a single process that can serve the built SPA — this keeps
local-first simple and makes the later deploy story (017) trivial.
