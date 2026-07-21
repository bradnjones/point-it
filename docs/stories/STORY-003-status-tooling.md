---
id: STORY-003
title: Progress-tracking tooling (npm run status)
epic: A Foundations
status: not-started
depends_on: [STORY-001]
commit_prefix: story-003
---

## Goal

Deliver the mechanism that answers "where are we at?" and "what's next?" by
reconciling documented story status with git commit history. This is what Claude
runs to report progress.

## Scope

- `scripts/status.mjs`, wired to `npm run status`.
- Parse every `docs/stories/STORY-*.md` frontmatter (`id`, `status`,
  `depends_on`, `epic`, `title`).
- Scan `git log --oneline` for `STORY-NNN` / `story-NNN` references (case-
  insensitive) and count commits per story.
- Report, grouped and color-coded:
  - **Done**, **In progress**, **Not started** counts and lists.
  - **What's next:** lowest-numbered `not-started` story whose `depends_on` are
    all `done`.
  - **Drift warnings:** story `done` with zero commits; commits reference a
    story still `not-started`; story `in-progress` with no commits.
- `--json` flag for machine-readable output.

## Acceptance criteria

- `npm run status` prints an accurate summary for the current repo state.
- Given a story marked `done` with no matching commits, a drift warning appears.
- "What's next" respects dependencies (won't suggest a story whose deps aren't
  done).
- Works when the repo has zero commits (reports everything not-started).

## Notes

Keep it dependency-light (Node built-ins + a tiny frontmatter parse). This script
is the contract behind the "where are we at" UX, so cover it with a unit test
over a fixture set of story files.
