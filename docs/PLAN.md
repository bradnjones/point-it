# point-it — Plan

## Context

The team estimates ("points") stories during refinement. Doing this verbally or
in a spreadsheet has two problems: people anchor on the first number they hear,
and there's no durable record of what was estimated or why. `point-it` fixes
both by letting each person submit an estimate privately, hiding all estimates
until the facilitator reveals them, and persisting every session for later
review.

**Goals**

1. Each person privately enters points for a story; estimates stay hidden until
   the facilitator reveals them.
2. Multiple people load the app in a browser and share one live session — when
   someone votes or the facilitator reveals, everyone's screen updates in real
   time.
3. Two estimation modes: **free-form** (one number) and **PERT** (optimistic /
   most likely / pessimistic, combined as `(O + 4M + P) / 6`).
4. An optional **reason** field captured alongside each vote.
5. A durable **history** of sessions and per-story estimates to look back on.
6. Manual story entry first; later, import GitLab work items whose **Status**
   property is "To Refine".
7. Claude (as developer) can answer **"where are we at?"** and **"what's next?"**
   by cross-referencing documented story status against git commit history.

## Decisions

| Area | Decision |
|------|----------|
| Backend | Node + Express |
| Real-time | Socket.IO (rooms = sessions) |
| Frontend | React + Vite |
| Persistence | SQLite (via `better-sqlite3`) |
| Identity | Display name + session code; one facilitator per session. No accounts. |
| Hosting | Local-first; designed for easy deploy (single Node process serving the built frontend). Deployment packaging is a later story. |
| GitLab | gitlab.com **GraphQL** API. "To Refine" is a work-item **Status** property (not a label), so REST issues won't surface it — use `workItems` with the Status widget. PAT stored in env. |
| Estimation scales | Configurable per session; default Fibonacci (`1,2,3,5,8,13,21,?`). PERT takes free numeric input. |

## Architecture

```
point-it/
├── server/                 # Express + Socket.IO + SQLite
│   ├── index.js            # app bootstrap, serves built client in prod
│   ├── db.js               # SQLite connection + migrations
│   ├── sockets.js          # real-time session events (join, vote, reveal…)
│   ├── routes/             # REST: sessions, stories, history, gitlab import
│   └── services/           # domain logic (voting, stats, gitlab client)
├── client/                 # React (Vite) SPA
│   ├── src/pages/          # Join, Session, History, HistoryDetail
│   ├── src/components/     # VoteCard, StoryList, RevealPanel, PertInput…
│   └── src/lib/socket.js   # Socket.IO client wrapper
├── scripts/
│   └── status.mjs          # "where are we at" progress report (STORY-003)
├── docs/
│   ├── PLAN.md             # this file
│   └── stories/            # one file per story, tracked
└── package.json            # workspaces: server + client; root scripts
```

**Real-time model.** Each session is a Socket.IO room keyed by session code.
Clients emit `vote:cast`; the server stores the vote and broadcasts only *that a
person has voted* (presence), never the value. On `reveal` (facilitator only),
the server broadcasts every vote value + reason + computed stats. State of record
lives in SQLite so a refresh or reconnect rehydrates the current round.

### Data model (SQLite)

- **sessions** — `id`, `code`, `name`, `mode` (`free_form` | `pert`), `scale`,
  `facilitator_token`, `created_at`, `closed_at`.
- **participants** — `id`, `session_id`, `display_name`, `is_facilitator`,
  `joined_at`, `last_seen_at`.
- **stories** — `id`, `session_id`, `title`, `description`, `external_ref`
  (GitLab work-item id/url, nullable), `final_points` (nullable), `order`,
  `created_at`.
- **rounds** — `id`, `story_id`, `round_number`, `revealed_at` (nullable). A
  story can be re-voted; each attempt is a round.
- **votes** — `id`, `round_id`, `participant_id`, `value` (free-form) **or**
  `pert_optimistic`/`pert_likely`/`pert_pessimistic`, `reason` (nullable),
  `created_at`. Unique on `(round_id, participant_id)`.

Stats (average, min/max spread, consensus flag, and for PERT the weighted
estimate + standard deviation `(P − O) / 6`) are computed on reveal in
`services/`.

## Roadmap (epics)

- **Epic A — Foundations:** scaffolding, data layer, status tooling.
- **Epic B — Core pointing (free-form):** create/join, add stories, private
  vote + reason, live presence, facilitator reveal + stats, finalize/re-vote.
- **Epic C — History:** persist and browse past sessions and estimates.
- **Epic D — PERT mode:** three-point input, weighted calc, mode toggle.
- **Epic E — GitLab:** connect, import "To Refine" work items, (stretch) write
  agreed points back.
- **Epic F — Deploy & polish:** packaging, facilitator-control hardening.

Dependency spine: **A → B → (C, D in parallel) → E → F**.

## Progress tracking — how "where are we at?" works

This is a first-class feature of the repo, not an afterthought.

1. **Every story** lives in `docs/stories/STORY-NNN-*.md` with YAML frontmatter
   including a `status` field: `not-started` | `in-progress` | `done`.
2. **Every commit** for a story references its id in the message, using
   Conventional Commits with the story id in the scope, e.g.
   `feat(story-006): hide votes until reveal`.
3. **`npm run status`** (STORY-003) reads all story frontmatter and scans
   `git log` for `STORY-NNN` references, then reports:
   - what's **done**, **in progress**, and **not started**;
   - **what's next** (lowest-numbered not-started story whose dependencies are
     all done);
   - **mismatches** to flag drift — e.g. a story marked `done` with no commits,
     or commits referencing a story still marked `not-started`.

When you ask Claude "where are we at?" or "what's next?", Claude runs this script
(and/or reads the story files + `git log`) and reports back against it.

## Out of scope (for now)

- Real user accounts / SSO (name + code is enough for a known team).
- Writing estimates back to GitLab (Epic E stretch story only).
- Mobile-native apps (the web UI is responsive).
