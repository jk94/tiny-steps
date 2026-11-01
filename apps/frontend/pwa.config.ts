import type { ManifestOptions } from 'vite-plugin-pwa';

// Web App Manifest for the "PWA basics" slice of Phase 4 (see
// docs/adr/0008-pwa-basics-via-vite-plugin-pwa.md). Pulled into its own file
// so vite.config.ts (the `manifest` option of the VitePWA plugin) and any
// other future consumer share one definition instead of duplicating it
// inline.
//
// `theme_color` is the design system's light `primary` token and
// `background_color` its light `canvas` token (the splash screen matches the
// page background the app then paints). The same `theme_color` value must also
// be used in index.html's `<meta name="theme-color">` tag.
export const pwaManifest: Partial<ManifestOptions> = {
  name: 'TinySteps',
  short_name: 'TinySteps',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#6246ea',
  background_color: '#fbf7f2',
  prefer_related_applications: false,
  icons: [
    {
      src: '/icons/pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/pwa-192x192-maskable.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icons/pwa-512x512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};
