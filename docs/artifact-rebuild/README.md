# point-it → Claude Artifact: rebuild bundle

Everything needed to rebuild point-it as a Claude Artifact, from a fresh Claude
Code session on a different account. The bundle is self-contained: no access to
the original repo is required.

| File | What it is |
|------|-----------|
| [`REBUILD_PROMPT.md`](REBUILD_PROMPT.md) | The prompt to paste into Claude Code to start the rebuild |
| [`CLAUDE.md`](CLAUDE.md) | Project instructions for the new repo (copy to its root) |
| [`PRODUCT.md`](PRODUCT.md) | What the app does, precisely: screens, rules, limits, messages, edge cases |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How it maps onto the artifact runtime (`db`, `user`, `room`), and what necessarily changes |
| [`reference/`](reference/) | A verbatim snapshot of the current `client/` and `server/` source and tests |

## How to use it

1. Create an empty directory for the new project and `git init` it.
2. Copy this whole folder into it as `handoff/` (keep `reference/` intact).
3. Copy `handoff/CLAUDE.md` to the new repo's root.
4. Start Claude Code in that directory on your work account and paste the
   prompt from `REBUILD_PROMPT.md`.
