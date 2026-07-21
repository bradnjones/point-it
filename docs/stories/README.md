# Story backlog

One file per story. Each has YAML frontmatter that `npm run status` (STORY-003)
reads to report progress. Update the `status` field as work proceeds:
`not-started` → `in-progress` → `done`.

**Commit convention:** reference the story id in the commit scope, e.g.
`feat(story-006): hide votes until reveal`. This is how commit history is
matched back to documented progress.

| ID | Title | Epic | Depends on |
|----|-------|------|-----------|
| [STORY-001](STORY-001-project-scaffolding.md) | Project scaffolding & dev workflow | A Foundations | — |
| [STORY-002](STORY-002-data-layer.md) | SQLite data layer & migrations | A Foundations | 001 |
| [STORY-003](STORY-003-status-tooling.md) | Progress-tracking tooling (`npm run status`) | A Foundations | 001 |
| [STORY-004](STORY-004-create-join-session.md) | Create & join a session (name + code, facilitator) | B Core | 002 |
| [STORY-005](STORY-005-add-stories.md) | Add stories to a session manually | B Core | 004 |
| [STORY-006](STORY-006-private-voting.md) | Cast a private vote with optional reason | B Core | 005 |
| [STORY-007](STORY-007-live-presence.md) | Live presence & "who has voted" indicators | B Core | 006 |
| [STORY-008](STORY-008-reveal-and-stats.md) | Facilitator reveal + vote stats | B Core | 006 |
| [STORY-009](STORY-009-finalize-and-revote.md) | Finalize points & re-vote rounds | B Core | 008 |
| [STORY-010](STORY-010-history-list.md) | Session & estimation history (browse) | C History | 008 |
| [STORY-011](STORY-011-history-detail.md) | History detail view | C History | 010 |
| [STORY-012](STORY-012-pert-estimation.md) | PERT three-point estimation | D PERT | 006 |
| [STORY-013](STORY-013-mode-toggle.md) | Per-session mode toggle (free-form / PERT) | D PERT | 012 |
| [STORY-014](STORY-014-gitlab-connect.md) | GitLab connection & config | E GitLab | 004 |
| [STORY-015](STORY-015-gitlab-import.md) | Import "To Refine" work items | E GitLab | 014, 005 |
| [STORY-016](STORY-016-gitlab-writeback.md) | Write agreed points back to GitLab (stretch) | E GitLab | 015, 009 |
| [STORY-017](STORY-017-deploy-packaging.md) | Deployment packaging | F Polish | 008 |
| [STORY-018](STORY-018-facilitator-hardening.md) | Facilitator-control hardening (stretch) | F Polish | 009 |

**Suggested build order:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009,
then Epic C (010, 011) and Epic D (012, 013) in either order, then Epic E
(014, 015, 016), then Epic F (017, 018).
