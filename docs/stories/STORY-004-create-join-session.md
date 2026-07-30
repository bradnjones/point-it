---
id: STORY-004
title: Create & join a session (name + code, facilitator)
epic: B Core
status: done
depends_on: [STORY-002]
commit_prefix: story-004
---

## Goal

Let one person create a pointing session and others join it live with just a
display name and a session code.

## Scope

- REST: create session (returns code + facilitator token), join session by code.
- The creator is the **facilitator**; their token grants reveal/finalize powers
  (held client-side, verified server-side on privileged actions).
- Socket.IO: joining a session code enters that room; presence list broadcasts to
  all members in real time.
- Client: Join page (enter name, create or join by code) → Session page shell
  showing session name, code (shareable), and live participant list.
- Reconnect/refresh rehydrates the participant into the same session.

## Acceptance criteria

- Two browsers joining the same code appear in each other's participant list
  within a second, no manual refresh.
- Facilitator is visually distinguished; non-facilitators never receive the
  facilitator token.
- Invalid/closed codes produce a clear error.
- Refreshing keeps you in the session.

## Notes

Session code should be short and human-shareable (e.g. 6 chars). Store the
facilitator token server-side (hashed) and require it on privileged socket/REST
actions rather than trusting the client.
