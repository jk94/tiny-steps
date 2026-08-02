import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev-only same-origin proxy to the backend (must be running via
      // `bun run --cwd apps/backend start:dev`). None of the auth cookies
      // set an explicit `Domain` attribute, so a cookie received while the
      // address bar shows `localhost:5173` is stored against `localhost`
      // and gets sent on subsequent requests to `localhost:5173/api/...`
      // regardless of this proxy actually forwarding to port 3000. That's
      // what lets the SPA use `credentials: 'same-origin'` with zero
      // CORS/cross-origin handling, matching the single-container
      // production topology where the backend serves the built SPA from
      // the same origin.
      // `ws: true` also makes this proxy forward the WebSocket upgrade
      // request itself (not just plain HTTP) for `RealtimeGateway`'s
      // handshake at `/api/socket.io` (see its doc comment for why the
      // Socket.IO path lives under `/api` rather than at Socket.IO's own
      // default `/socket.io`) — harmless for the plain REST requests this
      // same entry proxies, since `ws` only matters when an upgrade is
      // actually requested.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
