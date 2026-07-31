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

/**
 * Emits an event and resolves with the server's ack. Rejects if the ack carries
 * an `{ error }`, so callers can `try/await` a mutation like a normal request.
 */
export function emitWithAck(event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack) => {
      if (ack?.error) reject(new Error(ack.error));
      else resolve(ack);
    });
  });
}
