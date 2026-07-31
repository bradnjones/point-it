---
id: STORY-005
title: Add stories to a session manually
epic: B Core
status: done
depends_on: [STORY-004]
commit_prefix: story-005
---

## Goal

Populate a session with the stories to estimate by typing them in.

## Scope

- REST + socket: add a story (title required, description optional), edit, delete,
  reorder within a session.
- Client: story list panel on the Session page; add/edit form; select the
  "active" story that everyone is currently estimating.
- Changes to the story list and the active story broadcast live to all members.

## Acceptance criteria

- Facilitator adds a story; it appears for all participants immediately.
- The active story is highlighted consistently for everyone.
- Reordering and editing propagate live.
- Story list survives refresh (persisted via STORY-002).

## Notes

Leave room for `external_ref` on the story record (GitLab import, STORY-015) even
though manual entry doesn't set it. Consider whether non-facilitators may add
stories — default: facilitator only, but keep the check in one place so it's easy
to relax.
