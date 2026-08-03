---
id: STORY-019
title: Quick (ad-hoc) estimation sessions
epic: B Estimation
status: done
depends_on: [STORY-009]
commit_prefix: story-019
---

## Goal

Point work without tying estimates to individual stories. The facilitator says
"throw points", everyone submits privately, the facilitator reveals, then resets
and does it again — the same session, over and over, with no backlog to manage.

## Scope

- New session `kind`: `stories` (the managed backlog, default) vs `quick`.
  Orthogonal to `mode` (free_form/pert).
- A quick session is provisioned with one implicit, always-active story and an
  open round, so members can vote the moment they join.
- Reuse the existing vote / reveal machinery unchanged. "Reset" reuses re-vote,
  but a quick reset discards the round just voted on (no per-round history).
- Client: choose the session type when creating; quick sessions hide the stories
  panel and the finalize control, show a generic "throw your points" prompt, and
  relabel re-vote as "New round". History flags quick sessions.

## Acceptance criteria

- Creating a quick session immediately allows voting with no "start a story"
  step; joining members can vote right away.
- Reveal shows the spread/stats as usual; "New round" clears every client's vote
  and reveal and starts fresh.
- A quick reset leaves no accumulated rounds or votes in the database.
- Backlog (`stories`) sessions are unchanged, including their re-vote history.

## Notes

Unplanned mid-stream request. The reset behavior already existed as re-vote
(STORY-009); the only new server logic is provisioning the implicit story and
deleting the prior round on a quick reset. The distinct round id per reset is
what drives each client to clear its vote and reveal.
