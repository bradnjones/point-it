---
id: STORY-009
title: Finalize points & re-vote rounds
epic: B Core
status: done
depends_on: [STORY-008]
commit_prefix: story-009
---

## Goal

After a reveal, let the team either agree a final number or re-vote (common when
estimates diverge and people discuss).

## Scope

- Facilitator sets the story's **final points** (free choice, often after
  discussion) — persisted on the story.
- **Re-vote:** facilitator opens a new round for the same story; presence and
  votes reset while prior rounds are retained in history.
- Advance to the next story in the list; the finalized one is marked done.
- Everyone sees the finalized value and round transitions live.

## Acceptance criteria

- Finalizing records `final_points` on the story and shows it to all.
- Re-vote creates round N+1; prior round's votes remain queryable for history.
- The session can proceed through all its stories and mark them estimated.

## Notes

`rounds` from STORY-002 already models multiple attempts — this story exercises
it. Final points and each round's votes both feed the history epic (C).
