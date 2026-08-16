import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook is scoped ONLY to the design-system primitives
 * (`src/components/ui/**`), not the feature-coupled components, so the catalog
 * stays a clean, Claude-Design-compatible component library (see ADR-0013 and
 * docs/known-issues.md's `/design-sync` note).
 */
const config: StorybookConfig = {
  stories: ['../src/components/ui/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Storybook loads the app's vite.config.ts (so the Tailwind plugin + tokens
  // are live in stories). But the app's VitePWA plugin tries to precache
  // Storybook's own multi-MB manager bundle and fails the build — strip it
  // here, since Storybook needs no service worker/manifest.
  async viteFinal(viteConfig) {
    const plugins = (viteConfig.plugins ?? []) as unknown[];
    viteConfig.plugins = plugins.flat(Infinity).filter((plugin) => {
      const name =
        plugin && typeof plugin === 'object' && 'name' in plugin
          ? String((plugin as { name: unknown }).name)
          : '';
      return !name.toLowerCase().includes('pwa');
    }) as typeof viteConfig.plugins;
    return viteConfig;
  },
};

export default config;
