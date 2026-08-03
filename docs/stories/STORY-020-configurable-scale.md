---
id: STORY-020
title: Configurable point scales & hours-per-point
epic: B Estimation
status: done
depends_on: [STORY-008]
commit_prefix: story-020
---

## Goal

Let the facilitator choose the point system for a session instead of always
using Fibonacci — including a plain linear scale — and optionally map points to
time so a revealed round shows an estimated duration.

## Scope

- Creation: pick a scale (Fibonacci default, Linear 1–10, or a custom
  comma-separated list) and an optional hours-per-point rate.
- Server validates/normalizes the scale (trim, drop blanks, de-dupe, 2–20
  values, ≤8 chars each) and the rate (positive, ≤100); rejects bad input.
- The chosen scale already drives voting and vote validation (STORY-006); this
  just lets it be set. `hours_per_point` is persisted on the session.
- Reveal shows an "Est. time" stat (average × rate) when a rate is set.

## Acceptance criteria

- A session created with Linear 1–10 accepts votes 1–10 and rejects off-scale
  values.
- A custom scale round-trips through creation, voting, and reveal.
- With a rate set, the reveal shows the average's time equivalent; with no rate,
  no time is shown.
- Existing sessions and the Fibonacci default are unaffected.

## Notes

The `scale` column has existed since STORY-001 but nothing set it. Migration
0004 adds `hours_per_point` (nullable). Time is computed on the client from the
session rate and the average, keeping server stats point-only.
