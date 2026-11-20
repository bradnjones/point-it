import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { registerSocketHandlers } from './sockets.js';
import { getDb } from './db.js';
import { createPresence } from './services/presence.js';

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const db = getDb();
const presence = createPresence();

const app = createApp({ db, presence });
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

registerSocketHandlers(io, db, presence);

server.listen(PORT, () => {
  console.log(`[point-it] server listening on http://localhost:${PORT}`);
});
