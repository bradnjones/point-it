# Rebuild prompt

Paste everything below the line into Claude Code, started in the new repo (with
`handoff/` copied in and `handoff/CLAUDE.md` copied to the root).

---

I'm rebuilding an existing app called **point-it** as a Claude Artifact. It's a
real-time planning-poker tool. People join a session by code, vote privately on
stories, and nobody sees anyone else's estimate until the facilitator reveals.
The original is a Node/Express + Socket.IO + SQLite backend with a React
frontend. The new version has no backend: it's one HTML page on claude.ai that
uses the artifact runtime's `db`, `user` and `room` capabilities.

**The goal is a product as close to the original as possible:** same screens,
same copy, same styling, same rules, same behavior. Where the platform forces a
difference, make the smallest one and tell me.

Read these first, in this order:

1. `handoff/PRODUCT.md`: the behavioral contract.
2. `handoff/ARCHITECTURE.md`: the platform design: data paths, access rules,
   the reveal protocol, presence, code layout, testing approach, and the known
   differences from the original.
3. `handoff/reference/`: the original source. `client/src/` holds the UI and its
   tests. `server/` holds the rules: `routes/sessions.js` (create/join/history
   and validation), `sockets.js` (every real-time action and its edge cases) and
   `services/stats.js`. The server tests are the best spec of edge cases.
4. The `artifact-capabilities` skill and its `db.d.ts`, `user.d.ts` and
   `room.d.ts`. These are authoritative on the API. If they contradict
   ARCHITECTURE.md, follow them and update the doc.

How I want you to work:

- **Reuse, don't reinvent.**
  - Port `styles.css`, `VotePanel`, `RevealPanel`, `StoriesPanel`, `History`,
    `Join`, `computeStats` and the scale and hours normalization verbatim, along
    with their tests.
  - Rewrite only what touched the network: `App`, `Session`, and the `lib/`
    layer, which become the platform, store and hooks layers.
- **TDD.**
  - Build the in-memory fake platform first. It should enforce the same
    `{self}` and private-path rules as the real one.
  - Then port the server behavior tests as store tests against it, especially
    the guarantee that no other participant's vote value is visible before
    reveal.
- Give me a short plan before you start writing code: the order you'll build
  in, and anything in the docs that looks wrong or unworkable. Challenge the
  design if it won't work. After that, work through it, committing small
  Conventional Commits as you go.
- Run tests, lint and the build before you call anything done.
- When it works against the fake platform:
  1. Build `dist/index.html` and publish it as an artifact with the capabilities
     from ARCHITECTURE.md.
  2. Check the data with `ArtifactData`.
  3. Give me the link, plus a short list of what I need to test by hand with a
     second person, since live multi-user behavior can't be fully checked solo.
- Don't build the "Not built yet" items in PRODUCT.md, but don't paint the data
  model into a corner for them either.
