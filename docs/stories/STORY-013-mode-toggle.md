---
id: STORY-013
title: Per-session mode toggle (free-form / PERT)
epic: D PERT
status: not-started
depends_on: [STORY-012]
commit_prefix: story-013
---

## Goal

Let the facilitator choose the estimation method when creating a session.

## Scope

- Session creation (STORY-004) gains a `mode` choice: `free_form` (default) or
  `pert`.
- The Session page renders the correct vote input and reveal panel per mode.
- History (Epic C) labels each session with its mode and renders accordingly.
- (Optional) allow switching mode before any votes are cast; lock it once voting
  starts.

## Acceptance criteria

- Creating a PERT session routes all voters into the three-point flow.
- Creating a free-form session is unchanged from Epic B.
- A session's mode is persisted and shown in history.

## Notes

`sessions.mode` already exists (STORY-002). This story is mostly wiring the mode
through create → session UI → reveal → history.
