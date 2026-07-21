import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds the Express app. Kept separate from index.js so tests can exercise
 * routes without opening a port or starting Socket.IO.
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // In production the built client is served by this same process, so there is
  // only ever one thing to deploy. In dev, Vite serves the client and proxies
  // /api and /socket.io here, so this block is inert.
  const clientDist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback for anything that isn't an API call. Express 5 no longer
    // accepts a bare '*' path, hence the regex.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
