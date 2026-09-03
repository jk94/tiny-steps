import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { workspaceAliases } from './workspace-aliases.ts';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      ...workspaceAliases,
      // vite-plugin-pwa's Vite plugin (not registered here, only in
      // vite.config.ts) is what normally resolves this virtual module —
      // see src/test/virtualPwaRegisterReactStub.ts's doc comment.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/virtualPwaRegisterReactStub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    // The shared growth-chart package's own specs run in this suite rather
    // than a second Vitest project: they are React component tests needing the
    // exact same jsdom environment, and one `bun run --cwd apps/frontend test`
    // should not silently skip them.
    // The design-system token codegen's specs run here too, for the same
    // reason: it has no runner of its own, and its output feeds this app.
    include: [
      'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../../packages/*/src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../../design-system/scripts/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
  },
});
