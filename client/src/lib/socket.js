import { io } from 'socket.io-client';

/**
 * Shared Socket.IO client.
 *
 * No URL is passed, so it connects to the page's own origin: Vite proxies
 * /socket.io to the Node server in dev, and in production the Node server
 * serves the client directly. autoConnect is off so components decide when
 * to open the connection.
 */
export const socket = io({ autoConnect: false });

export function connectSocket() {
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
