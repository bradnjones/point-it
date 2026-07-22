import { defineConfig } from 'vitest/config';

// Root-level tests only (the tooling in scripts/). Each workspace runs its own
// Vitest via `npm run test --workspaces`.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
  },
});
