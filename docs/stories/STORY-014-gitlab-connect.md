---
id: STORY-014
title: GitLab connection & config
epic: E GitLab
status: not-started
depends_on: [STORY-004]
commit_prefix: story-014
---

## Goal

Establish an authenticated connection to gitlab.com so work items can be pulled
in later.

## Scope

- Config via env (`GITLAB_TOKEN`, `GITLAB_GRAPHQL_URL` defaulting to
  `https://gitlab.com/api/graphql`, and a default project/group path).
- `server/services/gitlab.js`: a thin GraphQL client with a `testConnection`
  query (e.g. `currentUser`) and a helper to list projects the token can see.
- REST: a "test connection" endpoint the UI can call; surface a clear status
  (connected as <user> / auth failed / network error).
- Document token scopes needed (`read_api`) in `.env.example` and PLAN.

## Acceptance criteria

- With a valid PAT, the test endpoint reports the authenticated user.
- With a missing/invalid token, a clear, non-crashing error is returned.
- No token or secret is ever sent to the client.

## Notes

**Verify the exact GraphQL shape against a real gitlab.com project before
building STORY-015** — the work-item **Status** widget is a newer field and its
schema (widget type name / status set) must be confirmed live. This story de-risks
that by getting a working authenticated query first.
