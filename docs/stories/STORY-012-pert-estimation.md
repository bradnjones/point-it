---
id: STORY-012
title: PERT three-point estimation
epic: D PERT
status: not-started
depends_on: [STORY-006]
commit_prefix: story-012
---

## Goal

Offer PERT estimation as an alternative to free-form: each voter gives
optimistic / most likely / pessimistic values.

## Scope

- PERT vote input: three numeric fields (O, M, P) + optional reason, written to
  the PERT columns from STORY-002.
- Extend the stats service: per-voter PERT estimate `(O + 4M + P) / 6` and std
  dev `(P − O) / 6`; round-level aggregate (mean of estimates, overall spread).
- Reveal (STORY-008) renders the three-point inputs and computed estimates.
- Validation: `O ≤ M ≤ P`.

## Acceptance criteria

- In PERT mode, voters submit three values; others can't see them before reveal.
- Weighted estimate and std dev are correct (unit-tested).
- Reveal shows each voter's O/M/P, their weighted estimate, and the round
  aggregate.
- Invalid ordering (e.g. O > P) is rejected with a clear message.

## Notes

No schema change needed — columns exist from STORY-002. The session mode toggle
that routes voters into this flow is STORY-013.
