---
id: STORY-010
title: Session & estimation history (browse)
epic: C History
status: done
depends_on: [STORY-008]
commit_prefix: story-010
---

## Goal

Look back at what the team estimated in past sessions.

## Scope

- REST: list past sessions (name, date, story count, participant count) with
  paging/sort by date.
- Client: History page listing sessions, newest first; click through to detail
  (STORY-011).
- Distinguish active vs. closed sessions; a facilitator can close a session.

## Acceptance criteria

- Completed sessions appear in the history list with accurate summary counts.
- The list is durable across restarts (SQLite).
- Empty state is handled cleanly.

## Notes

All data already persists via STORY-002; this epic is primarily read-side and UI.
