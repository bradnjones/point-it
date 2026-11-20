import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API and websocket traffic to the Node server so the client can use
    // same-origin URLs in both dev and production.
    proxy: {
      '/api': SERVER,
      '/socket.io': { target: SERVER, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
});
