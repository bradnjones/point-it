# point-it

A real-time story-pointing tool for estimating work as a team.

Team members join a shared session and privately submit their estimate for each
story. No one can see anyone else's estimate until the facilitator reveals the
votes. Supports free-form (single number) and PERT (three-point) estimation,
keeps a full history of past sessions, and can import work items from GitLab.

## Status

Planning complete. Implementation not yet started. See [`docs/PLAN.md`](docs/PLAN.md)
for the architecture and roadmap, and [`docs/stories/`](docs/stories/) for the
tracked backlog.

To ask "where are we at?" / "what's next?", run:

```bash
npm run status
```

(That command is delivered by STORY-003; until then, read the backlog directly.)

## Tech stack

- **Backend:** Node + Express, Socket.IO for real-time
- **Frontend:** React (Vite)
- **Persistence:** SQLite
- **Integration:** GitLab GraphQL API (work items with status "To Refine")

## Quick start

_Not yet available — delivered by STORY-001._
