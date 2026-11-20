import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'data/**',
      // Verbatim snapshot for the artifact rebuild; not part of this app.
      'docs/artifact-rebuild/reference/**',
    ],
  },
  js.configs.recommended,
  {
    // Server, scripts, and root config files run in Node.
    files: ['server/**/*.js', 'scripts/**/*.{js,mjs}', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    // Client runs in the browser and uses JSX.
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/setupTests.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
