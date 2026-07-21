---
id: STORY-008
title: Facilitator reveal + vote stats
epic: B Core
status: not-started
depends_on: [STORY-006]
commit_prefix: story-008
---

## Goal

The facilitator reveals all votes at once, and everyone sees the full spread plus
useful stats.

## Scope

- Facilitator-only `reveal` action (verified via facilitator token) closes the
  current round for voting and broadcasts every vote value + reason to the room.
- Compute and display stats: average, min/max (spread), distribution, and a
  **consensus** flag (all equal). For PERT rounds (STORY-012) the reveal also
  shows the weighted estimate and std dev.
- Client reveal panel: each participant's name, value, and reason; a clear
  "revealed" state.
- Non-facilitators cannot trigger reveal.

## Acceptance criteria

- Only the facilitator can reveal; a non-facilitator attempt is rejected
  server-side.
- On reveal, all browsers show all values + reasons simultaneously.
- Stats are correct (checked by unit tests on the stats service).
- Once revealed, votes are locked for that round (re-vote is STORY-009).

## Notes

Put stats math in `server/services/` with direct unit tests so PERT (STORY-012)
can extend the same module. This is the natural end of a demoable free-form MVP.
