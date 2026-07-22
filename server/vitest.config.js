import { defineConfig } from 'vitest/config';

// The server needs its own config: without one, Vitest walks up and inherits
// the root config (which only includes scripts/**), finds no tests here, and
// exits non-zero.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
  },
});
