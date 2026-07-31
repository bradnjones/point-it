---
id: STORY-007
title: Live presence & "who has voted" indicators
epic: B Core
status: done
depends_on: [STORY-006]
commit_prefix: story-007
---

## Goal

Give the room live feedback on voting progress without leaking any values.

## Scope

- Broadcast, in real time, *which* participants have submitted a vote for the
  current round — value stays hidden.
- Per-participant state: not voted / voted (and optionally "changed").
- A round progress summary (e.g. "4 of 6 voted") for the facilitator's reveal
  decision.
- Handle disconnect/reconnect: presence reflects who is actually connected.

## Acceptance criteria

- When one browser votes, all others see that person flip to "voted" within a
  second — with no value shown.
- The voted/total count is accurate as people join, leave, and vote.
- A disconnected participant is reflected in presence.

## Notes

Reuse the room broadcast from STORY-004. The only new payload is a boolean per
participant — deliberately never the value.
