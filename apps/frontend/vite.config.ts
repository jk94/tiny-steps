import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './pwa.config.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Tailwind CSS v4, driven by the externally-generated design tokens
    // (see docs/adr/0013-design-system-styling-approach.md). Preflight is
    // deliberately NOT imported in src/index.css — see the note there.
    tailwindcss(),
    // "PWA basics" slice of Phase 4 (see docs/adr/0008-pwa-basics-via-vite-plugin-pwa.md):
    // installable app shell (manifest + service worker) via the `generateSW`
    // strategy (the plugin's default `strategies`). Registration is done
    // explicitly from app code (`src/pwa/registerServiceWorker.ts`), not
    // auto-injected, hence `injectRegister: false`.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: pwaManifest,
      includeAssets: [
        'icons/app-icon.svg',
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/pwa-192x192-maskable.png',
        'icons/pwa-512x512-maskable.png',
        'apple-touch-icon.png',
      ],
      workbox: {
        navigateFallback: 'index.html',
        // API and WebSocket traffic must stay network-only — this slice is
        // app-shell caching only, not offline data (that's a later,
        // out-of-scope slice; see ADR-0008).
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
