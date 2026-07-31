---
id: STORY-006
title: Cast a private vote with optional reason
epic: B Core
status: done
depends_on: [STORY-005]
commit_prefix: story-006
---

## Goal

The core privacy guarantee: each person submits their estimate for the active
story and **cannot see anyone else's** until reveal.

## Scope

- Free-form vote entry for the active story: pick/enter a value from the session
  scale (default Fibonacci `1,2,3,5,8,13,21,?`) plus an **optional reason** text
  field.
- Voting binds to the active story's current open **round** (STORY-002 `rounds`).
- Server stores the vote; a participant can change their vote until reveal.
- **Server never sends other participants' vote values before reveal** — this is
  enforced server-side, not just hidden in the UI.
- Client shows *your own* current vote and lets you change it.

## Acceptance criteria

- With two browsers, neither can see the other's value before reveal — verified
  by inspecting the socket/network payloads, not just the rendered UI.
- Re-submitting updates the existing vote (uniqueness on round+participant).
- Reason is optional and persisted with the vote.
- Switching the active story presents a fresh, empty vote for the new story.

## Notes

This is the highest-integrity story — the hidden-until-reveal rule must hold at
the transport layer. Presence ("has voted") is STORY-007; reveal is STORY-008.

### Why enforce hiding server-side (do not relax this)

Not a security concern — there's no sensitive data here. It's **product
integrity**: preventing anchoring bias is the only reason this tool exists, and
the users are developers, for whom devtools is not an exotic capability.

It was chosen because it is **simpler, not stricter**:

- The server must already hold every vote (for history and reconnect), so no new
  infrastructure is involved. The only question is whether the pre-reveal payload
  includes the `value` field. It doesn't.
- Pre-reveal broadcasts send **less** data, via one `.map()` that strips values
  until `revealed`.
- The client gets simpler: it renders whatever it's given, instead of carrying a
  `revealed` flag that every vote-displaying component must remember to check.
  Nothing to forget means no new leak path when components are added later.
- The same serializer covers the refresh/reconnect rehydration payload, so
  there's one rule in one place rather than two.

Failure mode if relaxed: a leak is plausible **by accident** (a stray
`console.log`, React DevTools open while screen-sharing) — and the moment anyone
demonstrates they could see votes early, every estimate in the recorded history
becomes retroactively suspect. Near-zero cost, high-consequence failure.

Retrofitting this later is expensive: it changes the socket protocol, reveal
logic, rehydration, and their tests, after history rows have already been
collected under the weaker guarantee.
