# point-it (artifact edition)

A real-time story-pointing app, delivered as a **Claude Artifact**: a single HTML
page on claude.ai, using runtime capabilities instead of a backend. It is a
faithful port of an existing Node/React app.

## Source of truth

- `handoff/PRODUCT.md`: what the app does. Behavior, copy and validation
  messages must match it.
- `handoff/ARCHITECTURE.md`: how it runs on the artifact runtime: data model,
  access rules, protocols, and the known differences from the original.
- `handoff/reference/`: the original implementation. When unsure how something
  looked or behaved, read the original and match it. Don't edit this folder.

When the docs and the reference disagree, the reference wins on UI and behavior,
and ARCHITECTURE wins on platform mechanics. Record any deliberate deviation in
ARCHITECTURE.md under "Differences".

## Stack

- React + Vite, bundled to a single `dist/index.html` with
  `vite-plugin-singlefile`.
- Artifact capabilities: `db`, `user`, `room`. Before touching platform code,
  load the `artifact-capabilities` skill and read its `.d.ts` files. They are
  authoritative over anything remembered.
- Before publishing, load the `artifact-design` skill.
- Vitest + React Testing Library (jsdom).
- Use npm, ESLint and Prettier (`.prettierrc.json` from the reference: single
  quotes, 2 spaces, width 100).

## Commands

```bash
npm run dev     # Vite dev server against the fake platform (no claude.ai needed)
npm test        # Vitest
npm run lint
npm run build   # → dist/index.html, the artifact
```

## Conventions

- Keep the domain logic pure (`src/domain/`) and port it from the reference
  server verbatim, with its tests.
- All platform access goes through `src/platform/`. Components never call
  `claude.use` directly.
- `src/platform/fake.js` mirrors the real access rules. Privacy-critical tests
  (no vote value visible before reveal) run against it.
- Write tests alongside or before the implementation.
- Commits use Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`,
  `chore:`, `docs:`), are small, and contain one logical change each.
- Never `localStorage` anything that must be shared or must persist reliably;
  that belongs in `db`.

## Publishing

- Publish `dist/index.html` with the Artifact tool, declaring the capabilities
  in ARCHITECTURE.md.
- Republish to the **same** artifact URL for every release.
- After the first publish, check each collection the page writes with
  `ArtifactData`. Confirm another user's `data/users/` picks aren't readable at
  a lower level.
