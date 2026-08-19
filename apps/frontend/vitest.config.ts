import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
  },
});
