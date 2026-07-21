---
id: STORY-016
title: Write agreed points back to GitLab (stretch)
epic: E GitLab
status: not-started
depends_on: [STORY-015, STORY-009]
commit_prefix: story-016
---

## Goal

Close the loop: once a story is finalized, optionally push the agreed estimate
back to its GitLab work item.

## Scope

- On finalize (STORY-009) for a GitLab-linked story, offer to write the estimate
  back — via the work item's weight/estimate field or a comment (confirm what's
  writable via GraphQL mutation; needs `api` scope, not just `read_api`).
- Explicit, opt-in action (facilitator only); never automatic.
- Record that write-back happened and surface success/failure.

## Acceptance criteria

- Facilitator can push a finalized estimate to the linked work item.
- Non-linked (manual) stories don't show the option.
- Failures are reported clearly and don't corrupt local state.

## Notes

Stretch — depends on which fields the team's projects allow writing. Requires a
broader token scope than import, so keep it clearly separated and optional.
