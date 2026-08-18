import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wrapper config — see ADR-0012 for why Capacitor (not Tauri).
 *
 * `webDir: 'dist'` points at Vite's build output; `cap sync` copies that into
 * the native `android`/`ios` projects.
 *
 * ── Cookie / origin auth risk (see docs/known-issues.md) ──────────────────
 * The session design (ADR-0001) uses httpOnly, `SameSite=Lax` cookies and
 * `credentials: 'same-origin'` (see `apps/frontend/src/api/http-client.ts`),
 * which assumes the frontend and the backend share one origin — true for the
 * browser/PWA single-container deployment, but NOT automatically true inside a
 * Capacitor WebView, which by default serves the bundled web assets from a
 * local scheme origin (`https://localhost` on Android with the scheme below,
 * `capacitor://localhost` on iOS) that differs from the backend's HTTPS
 * origin. A `SameSite=Lax`, same-origin-scoped cookie set by the backend would
 * then not be sent on the WebView's cross-origin `/api` requests, silently
 * breaking auth.
 *
 * `androidScheme: 'https'` is set deliberately: it makes the Android WebView
 * origin a *secure* `https://localhost` (required for a secure context, and
 * closer to production semantics) rather than the insecure `http://` default.
 * It does NOT, on its own, make the WebView same-origin with a remote backend.
 *
 * Aligning origins for real depends on the (self-hosted, per-operator) backend
 * URL, which can't be hardcoded here. The two viable approaches — pointing the
 * WebView at the backend origin via `server.url`/`server.hostname`, versus a
 * backend CORS + `credentials: 'include'` + `SameSite=None` change — need a
 * real device against a real non-localhost backend to verify, so the decision
 * and its smoke test are tracked as a deferred manual item in
 * `docs/known-issues.md` rather than guessed at blindly here.
 */
const config: CapacitorConfig = {
  appId: 'me.jkoschke.babytracker',
  appName: 'TinySteps',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
