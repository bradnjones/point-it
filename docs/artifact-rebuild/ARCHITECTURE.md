# point-it on the Claude Artifact runtime — architecture

The original app is a Node server: Express REST, Socket.IO rooms and SQLite. It
serves a React SPA. A Claude Artifact is a single HTML page hosted on claude.ai,
with no server of its own. The backend is replaced by **runtime capabilities**
the page declares:

| Original | Artifact replacement |
|----------|---------------------|
| SQLite tables | `db`, a shared document store with access rules and live `onSnapshot` |
| Facilitator token | `user`: the viewer's opaque id. The facilitator is whoever's id created the session |
| Socket.IO broadcast | `db` `onSnapshot` on the documents each client renders |
| In-memory socket presence | `room`: `join(code)`, `presence()`, `onPeers()` |
| `localStorage` membership | still `localStorage` (per-viewer convenience only), wrapped in try/catch |
| Server-side validation | a pure domain layer in the page, plus `db` access rules for authority |

**The type definitions are authoritative.** Load the `artifact-capabilities`
skill and read its `db.d.ts`, `user.d.ts` and `room.d.ts` before writing
platform code. The paths and rules below are the intended design. If the runtime
contract disagrees with them, follow the contract and record the change here.

## Data model

There are no transactions, writes are last-writer-wins, and each document is
capped at 256 KiB. Every document has a single natural writer, so concurrent
writes to the same document essentially never happen.

| Path | Writer | Contents |
|------|--------|----------|
| `codes/<CODE>` | facilitator | Directory and history row: `{ code, facilitatorId, name, kind, mode, createdAt, closedAt, storyCount, participantCount }` |
| `control/<facilitatorId>/sessions/<CODE>` | facilitator only (rule-enforced) | Session state: `{ code, name, kind, mode, scale, hoursPerPoint, createdAt, closedAt, activeStoryId, stories: [{ id, title, description, finalPoints, rounds: [{ id, number, revealedAt }] }] }`. Array order is story order. The current round of a story is its last entry in `rounds` |
| `participants/<CODE>/members/<uid>` | that participant | `{ uid, displayName, isFacilitator, joinedAt }` |
| `ballots/<uid>/rounds/<roundId>` | that voter only (rule-enforced) | Public ballot: `{ code, roundId, voted: true, revealed: null }` pre-reveal, then `revealed: { value, reason }` after reveal |
| `data/users/<uid>/<roundId>` | that voter; **readable by nobody else** | Private pick: `{ code, roundId, value, reason }` |

Ids for stories and rounds come from `crypto.randomUUID()`, so round ids are
globally unique.

### Access rules (declare at publish)

```js
capabilities: {
  user: {},
  room: {},
  db: { rules: [
    // Session control: everyone reads; only the creator's own subtree is writable by them.
    { path: "control",          read: "view", write: "self" },
    { path: "control/{self}",   read: "view", write: "interact" },
    // Ballots: everyone reads (needed for "who voted" and the reveal); only the voter writes theirs.
    { path: "ballots",          read: "view", write: "self" },
    { path: "ballots/{self}",   read: "view", write: "interact" },
    // Private picks: own subtree only; private by default.
    { path: "data/users/{self}", write: "interact" },
  ]},
}
```

`self` is deliberate here. A vote must be its author's alone, and session
control must be the facilitator's alone. Even the artifact owner can't alter
them. That is what replaces the server's token checks and its hidden-until-
reveal guarantee.

## Protocols

**Create**
1. Run the domain layer's validation and normalization.
2. Generate a code, and retry if `codes/<CODE>` already exists.
3. Write the control document, then `codes/<CODE>`, then your member document
   (with `isFacilitator: true`).
4. For a quick session, the control document is written with the "Quick
   estimate" story, `activeStoryId` and round 1 already in place, in one `set`.

**Join**
1. Read `codes/<CODE>`. If it's missing, show `Session not found`. If
   `closedAt` is set, show `This session has been closed`.
2. If `participants/<CODE>/members/<uid>` exists, reuse it. Otherwise create it
   with a generated name.
3. The facilitator is `uid === codes.facilitatorId`. Nobody can claim it, since
   only that uid can write the control document.

**Vote**
1. Write the private pick to `data/users/<uid>/<roundId>`.
2. Then write the public ballot `{ voted: true, revealed: null }`.
3. "Who has voted" means participants whose ballot for the current round exists
   with `voted: true`.

**Reveal.** This is the platform's documented sealed-vote pattern.
1. The facilitator sets `revealedAt` on the current round in the control
   document.
2. Every client that sees its own round revealed copies its private pick into
   its public ballot's `revealed`. It also does this on load, if it missed the
   moment.
3. The reveal panel renders from ballots with `revealed` set, and the stats are
   computed in the page with the ported `computeStats`.
4. Votes trickle in over a second or so, and the panel updates live.

**Re-vote**
- Backlog: the facilitator appends a new round to the story.
- Quick: the facilitator replaces the story's rounds with the new one.
- Either way, every client sees a new current round id and resets its vote
  form and reveal. Old ballots stay behind; in quick sessions they're simply no
  longer referenced.

**Counts in History.** The facilitator's client keeps `codes/<CODE>.storyCount`
and `participantCount` in sync whenever its own snapshots change them.

**Presence**
1. Call `room.join("session:" + CODE)`, then `presence({ uid })`.
2. `onPeers` gives the connected set, which drives the dots.
3. Presence is display-only and never an authority.
4. If `room` resolves `null`, every participant shows as offline. The app keeps
   working.

**Subscriptions.** A view may hold at most 64 subscriptions. Subscribe to:
- the control document,
- the members collection,
- one ballot document per member for the **current round** (re-subscribe when
  the round changes).

That comfortably fits a team of up to about 50. Subscribe once per query, never
in render.

## Differences from the original (state these to the user; don't hide them)

1. **Reveal needs the voter's page open.**
   - A voter who has closed the tab when the facilitator reveals isn't in the
     results until they reopen it.
   - The panel should say "Waiting on N vote(s) to reveal" while some ballots
     are `voted` but not yet `revealed`, and the stats should cover the revealed
     votes only.
   - On the other hand, nobody (not even the owner) can peek at a vote early,
     which is stronger than the original guarantee.
2. **Post-reveal locking is enforced in the page, not by rules.**
   - A determined voter could rewrite their own revealed ballot afterwards.
   - The original server refused this.
   - It only affects that voter's own vote.
3. **The code directory and the member lists are writable by any Contributor.**
   - The rules can't express "only the facilitator of this session" for
     `codes/` or for "only this member" under `participants/<CODE>/`.
   - A malicious teammate could overwrite another member's row or a directory
     entry, but not session control or anyone's vote.
   - This is acceptable for a known team.
4. **Teammates must be Contributors.**
   - Viewers and Commenters can't write, so they can't vote.
   - Show a clear read-only notice when `user.can("data.write")` is false or a
     write is refused.
   - If `db` is `null` (signed out, or outside the organization), show a message
     instead of a broken app.
5. **History counts update only while the facilitator has the page open.**

## Code structure

Bundle into one HTML file. React and everything else are inlined (no CDN
needed), and the result is published with the Artifact tool.

```
src/
  domain/        # pure: validation + normalization (ported verbatim from server), stats, codes, names
  platform/
    index.js     # resolves claude.use('db'|'user'|'room'), exposes a small app-facing API
    fake.js      # in-memory db/user/room for tests, incl. rule enforcement for {self} paths
  store/         # session operations (create, join, vote, reveal, revote, …) over the platform API
  hooks/         # useSession(code): subscribes and assembles the same shape Session.jsx consumed
  components/    # VotePanel, RevealPanel, StoriesPanel: ported verbatim
  pages/         # Join, History: ported nearly verbatim; Session: rewired from socket to hooks
  App.jsx
  styles.css     # ported verbatim
```

- Build with Vite and `vite-plugin-singlefile`, outputting `dist/index.html`.
- Publish `dist/index.html` with the capabilities above. Republish to the same
  artifact on every release.
- The page must still satisfy the `artifact-design` skill's contract: a two- to
  four-word `<title>`, color tokens on `:root`, an explicit `body` background,
  and no horizontal scroll at phone width.
  - The current palette **is** the dark theme. Keep it exactly.
  - If a light theme is required, derive one, but don't change dark mode.

## Testing

- Use Vitest + React Testing Library with jsdom.
- Port every existing component test from `reference/client/src/**`, plus
  `stats.test.js`.
- Re-express the server behavior tests (`reference/server/routes/sessions.test.js`
  and `reference/server/sockets.test.js`) as `store/` tests against
  `platform/fake.js`. They are the best spec of edge cases, so cover the same
  cases, and especially that **no code path exposes another participant's value
  before reveal**.
- The fake must reject writes into another uid's `{self}` subtree, and hide
  other users' `data/users/` documents, exactly like the real rules. That way
  the tests prove the privacy model, not just the UI.
