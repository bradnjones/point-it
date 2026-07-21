---
id: STORY-018
title: Facilitator-control hardening (stretch)
epic: F Polish
status: not-started
depends_on: [STORY-009]
commit_prefix: story-018
---

## Goal

Tighten the facilitator experience and session controls once the core loop is
proven.

## Scope

- Facilitator handoff (transfer the role if the facilitator drops).
- Kick/rename a participant; guard against duplicate display names.
- Reclaim facilitator after disconnect via the stored token.
- Guardrails: prevent reveal with zero votes; confirm before re-vote wipes a
  round; auto-close idle sessions.
- Light auth review of all privileged actions in one place.

## Acceptance criteria

- If the facilitator disconnects, the role can be recovered or transferred
  without losing the session.
- Privileged actions are consistently authorized server-side.
- Edge cases (no votes, duplicate names) are handled gracefully.

## Notes

Pure polish/robustness — safe to defer until after real use surfaces the rough
edges.
