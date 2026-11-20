# point-it — product definition

A real-time story-pointing tool. Team members join a shared session and each
privately submits an estimate. **No one sees anyone else's estimate until the
facilitator reveals**, which prevents anchoring. Sessions persist so they can be
browsed later.

This document is the behavioral contract. The original implementation in
`reference/` is the tiebreaker for anything not stated here, especially UI copy,
layout and styling. Match it unless `ARCHITECTURE.md` says the platform forces a
difference.

## Concepts

- **Session**: has a 6-character share **code**, a **name**, a **kind**
  (`stories` or `quick`), a **mode** (`free_form` for now; `pert` is reserved for
  later), a **point scale**, an optional **hours per point**, a created time, and
  an optional closed time.
- **Facilitator**: the person who created the session. Exactly one per session.
  Only they can change stories, start estimating, reveal, re-vote, finalize, or
  close.
- **Participant**: anyone who has joined. Each gets an auto-assigned display name
  (see below). Nobody types a name.
- **Story** (backlog sessions only): title, optional description, a position in
  the list, and optional **final points**.
- **Round**: one voting attempt on a story. A story can have several rounds
  (re-votes). Only the latest round is "current". A round is either open or
  revealed.
- **Vote**: one per participant per round. It holds a scale value and an
  optional reason. It can be changed freely until the round is revealed.

## Session code

- 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (this alphabet has no
  ambiguous 0/O/1/I).
- Matching is case-insensitive: input is upper-cased and the input field
  upper-cases as you type. The field has a max length of 6, and Join is disabled
  until 6 characters are entered.
- If a generated code collides, retry up to 5 times.

## Display names

Names are auto-generated as `"<Adjective> <Animal>"`, for example "Swift Otter".

- Adjectives: Swift, Bold, Calm, Bright, Keen, Brave, Quick, Wise, Merry, Nimble,
  Lucky, Clever.
- Animals: Otter, Fox, Hawk, Panda, Lynx, Heron, Bison, Koala, Falcon, Badger,
  Wren, Moose.

Names aren't guaranteed unique. The "you" marker and the participant id
disambiguate. Rejoining the same session keeps your existing name.

## Screens

There are three screens and no router. Which one shows is decided by app state:
*joined → Session*, otherwise *Join*, or *History* when chosen from Join.

### Join (`reference/client/src/pages/Join.jsx`)

- Heading **point-it**, with the tagline "Estimate stories together, without
  anchoring."
- **Join a session**: a code field, plus a "Join session" button.
- An "or" divider.
- **Start a new session**:
  - Session name (required). The placeholder depends on kind: "e.g. Sprint 42
    refinement" for a backlog, or "e.g. Sprint 42 quick points" for quick.
  - Kind cards (a radiogroup):
    - **Story backlog**: "Add stories and estimate them one by one."
    - **Quick estimate**: "Throw points, reveal, reset — no stories to manage."
  - Point scale select: **Fibonacci** `1,2,3,5,8,13,21,?` (the default), **Linear
    1–10** `1,2,3,4,5,6,7,8,9,10`, or **Custom…**. Custom reveals a text field
    with the placeholder "Comma-separated, e.g. 1,2,3,4,5".
  - Hours per point (optional). This is a number input with step 0.5 and the
    placeholder "e.g. 2".
  - A "Create session" button, disabled until a name is entered.
- Errors show under the form.
- A "View past sessions" link at the bottom opens History.

### Session (`reference/client/src/pages/Session.jsx`)

- **Header**:
  - The session name ("Joining…" until loaded).
  - A code chip that copies the code to the clipboard and shows ✓ for 1.5s.
  - "Close session" for the facilitator while the session is open.
  - "Leave".
- **Closed banner**: "This session has been closed." when closed.
- **Participants panel**:
  - The heading is "Participants (N)". While a story is active it adds "X of N
    voted".
  - Each row shows:
    - A presence dot, green when connected and grey when not; offline rows are
      muted.
    - The name.
    - A "facilitator" badge.
    - A "you" marker.
    - While a story is active, either "✓ voted" or "…".
- **Vote panel** (`VotePanel.jsx`):
  - With no active story: "Waiting for the facilitator to start a story."
  - Otherwise it shows the story title. Quick sessions show "Throw your points."
    instead.
  - Scale chips are single-select.
  - An optional reason textarea.
  - The button reads "Cast vote", or "Update vote" once a vote is in. It is
    disabled until a value is chosen.
  - After voting, the hint reads "Your estimate is in — you can change it until
    the reveal."
  - The facilitator also sees **Reveal votes**.
  - After reveal, the form is replaced by "Votes are revealed — see the results
    below."
- **Reveal panel** (`RevealPanel.jsx`). This only renders once revealed. It
  shows:
  - The heading "Revealed", plus a **consensus** badge if every vote is
    identical.
  - Stats: Average, Spread (`min–max`), Est. time (only if hours per point is set
    and the average is numeric) and Votes.
  - A distribution as chips with ×count.
  - Each vote: name, value, reason.
  - Facilitator actions:
    - Backlog sessions get a **Final points** input with **Finalize**, plus
      **Re-vote**.
    - Quick sessions get only **New round**.
- **Stories panel** (`StoriesPanel.jsx`, backlog sessions only):
  - The heading is "Stories (N)".
  - Facilitator only: an add form with a title and an optional description.
  - The list is in position order. The active story is highlighted with an
    "estimating" badge, and finalized stories show an "N pts" badge.
  - Facilitator row actions: **Estimate** (disabled on the active story),
    **Edit** (inline editor with Save/Cancel), **↑**, **↓**, **Delete**.
  - Everyone else sees a read-only list.
  - Empty state: "No stories yet."

### History (`reference/client/src/pages/History.jsx`)

- The heading is "Past sessions", with a "Back" link.
- Lists all sessions, newest first. Each row shows:
  - The name, a "quick" badge for quick sessions, and an active/closed status
    badge.
  - The created date (medium date, short time).
  - The story count (omitted for quick sessions).
  - The participant count. Both counts are singular or plural as appropriate.
- States: loading ("Loading…"), empty ("No sessions yet. Start one to see it
  here."), and error.
- Rows aren't clickable yet. A history detail view is future work, and the
  component already accepts an `onOpen` prop for it.

## Rules and validation

Enforce these with the **same messages**. They were server-side and now belong
in the domain layer (see ARCHITECTURE).

| Input | Rule | Message |
|-------|------|---------|
| Session name | required after trim | `Session name is required` |
| Session name / display name | ≤ 80 chars | `Name is too long` |
| Scale | trim tokens, drop blanks, de-dupe keeping order; blank input → Fibonacci default | — |
| Scale | ≥ 2 distinct values | `A scale needs at least two distinct values` |
| Scale | ≤ 20 values | `That scale has too many values` |
| Scale | each token ≤ 8 chars | `A scale value is too long` |
| Hours per point | blank → none; else finite, > 0, ≤ 100 | `Hours per point must be a positive number` |
| Join code | session must exist | `Session not found` |
| Join code | session must be open | `This session has been closed` |
| Story title | required after trim | `Story title is required` |
| Story title | ≤ 200 chars | `Story title is too long` |
| Story description | ≤ 2000 chars; blank → none | `Description is too long` |
| Vote value | must be on the session scale | `That value is not on the scale` |
| Vote reason | ≤ 500 chars; blank → none | `Reason is too long` |
| Vote | needs an active story | `No story is being estimated` |
| Vote | round must not be revealed | `Voting is closed for this round` |
| Final points | required, ≤ 20 chars, free text (not limited to the scale) | `Final points are required` / `Final points value is too long` |
| Facilitator actions | non-facilitator | `Only the facilitator can do that` |

Reference implementations: `normalizeScale` / `normalizeHoursPerPoint` in
`reference/server/routes/sessions.js`, and the handlers in
`reference/server/sockets.js`.

## Behavior

- **Create**:
  - The creator becomes the facilitator and joins immediately.
  - For a **quick** session, also create one story titled "Quick estimate", set
    it active, and open round 1. This happens all at once, so the session is
    never seen active without a round. Members can vote the moment they join.
- **Estimate (set active story)**:
  - Makes the story the one everyone votes on.
  - If the story has no rounds, open round 1. If it does, reuse its latest round
    (a previously revealed round shows its results again).
  - Everyone's vote form and reveal reset to that round's state.
- **Vote**:
  - Only your own value is ever shown back to you.
  - The room learns only *that* you voted. The value is never shown to anyone
    else until reveal.
- **Reveal**:
  - Facilitator only, and idempotent.
  - Locks the round: no new or changed votes.
  - Shows all values, reasons and stats.
- **Stats** (`reference/server/services/stats.js`; port it and its tests
  verbatim):
  - Average is rounded to 2 decimals.
  - min, max and spread are calculated over numeric values only. Non-numeric
    values like `?` are counted in `count` and the distribution but excluded from
    the numeric stats.
  - `consensus` means every vote is identical and there is at least one vote.
  - The distribution is sorted numerically ascending, with non-numeric values
    last.
  - Est. time is `round(average × hoursPerPoint, 1 decimal)` followed by "h",
    with the note "At Xh per point."
- **Finalize** (backlog only): records final points on the story. Everyone sees
  the "N pts" badge.
- **Re-vote / New round**:
  - Opens a fresh round for the active story, and everyone's vote and reveal
    clear.
  - Backlog sessions keep prior rounds for history.
  - Quick sessions discard the previous round, so nothing accumulates.
- **Delete story**: if it was the active story, the active story clears and the
  vote and reveal reset.
- **Reorder**: ↑ and ↓ swap neighbours, and the full new order is persisted.
- **Close**:
  - Facilitator only.
  - The session stays in History marked closed and rejects new joins.
  - Connected members see the closed banner live. Nothing else is disabled.
- **Leave**: forgets the membership locally and returns to Join. The
  participant record remains.
- **Refresh / reopen**:
  - The app remembers the current session locally.
  - On load it rejoins if the session still exists and you're still a member.
    Otherwise it clears the memory and shows Join.
  - It shows "Loading…" while checking.
- **Live updates**: participants, presence, who has voted, stories, active
  story, reveal and closed state all update for everyone without a refresh.

## Look and feel

- A dark UI with a single centered column: max width 26rem on Join and 40rem
  elsewhere.
- Panels on a slightly lighter background, with blue as the accent, green for
  ok/consensus and red for errors/danger.
- Port `reference/client/src/styles.css` verbatim. The class names in the
  components depend on it.

## Not built yet (future direction, don't build now)

- History detail: drill into a past session to see each story, every round, all
  revealed votes and reasons, and the final points.
- PERT mode: each vote is optimistic, likely and pessimistic. Estimate =
  `(O + 4M + P) / 6`, std dev `(P − O) / 6`. Chosen per session.
- GitLab: import work items whose Status is "To Refine" (GraphQL `workItems`),
  and optionally write agreed points back. In an artifact this would likely go
  through a claude.ai connector (`mcp` capability).
- Facilitator hardening, such as handing off the facilitator role.

Design the data model so these fit without migration pain: keep revealed votes
per round, and leave room for PERT fields on a vote.
