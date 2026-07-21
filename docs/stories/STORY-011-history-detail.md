---
id: STORY-011
title: History detail view
epic: C History
status: not-started
depends_on: [STORY-010]
commit_prefix: story-011
---

## Goal

See the full estimation record for a past session — per story, what everyone
voted, why, and what was finalized.

## Scope

- REST: fetch one session with its stories, rounds, votes (values + reasons),
  participants, and final points.
- Client: detail page rendering each story with its rounds; show all votes and
  reasons, stats, and the finalized number. For PERT stories show the three-point
  inputs and weighted result.
- Read-only; export to CSV/JSON is a nice-to-have.

## Acceptance criteria

- Opening a past session shows every story with all rounds and votes/reasons.
- Re-voted stories show each round distinctly.
- Finalized points and (for PERT) weighted estimates render correctly.

## Notes

This is where the "keep a history and look back" goal is fully realized. Reuse the
stats service (STORY-008/012) for display so numbers match the live session.
