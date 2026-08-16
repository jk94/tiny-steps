// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    // Files/directories no config in this repo should ever lint.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/*.config.js',
      'apps/backend/prisma/**',
      // Generated Capacitor native projects (Gradle/Xcode scaffolding plus
      // copied web assets) — not our source, see ADR-0012.
      'apps/frontend/android/**',
      'apps/frontend/ios/**',
      // Storybook build output (design-system component catalog, Phase 6 M1).
      'apps/frontend/storybook-static/**',
      // claude.ai/design sync tooling/output — staged scripts, build output,
      // generated .d.ts declarations (types/), and sync state/fixtures under
      // .design-sync/ (including committed preview overrides — a specialized
      // fixture format for the sync, not application source).
      '.ds-sync/**',
      'ds-bundle/**',
      'apps/frontend/types/**',
      '.design-sync/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend (NestJS, Node runtime)
  {
    files: ['apps/backend/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
    rules: {
      // Nest decorators commonly rely on empty constructors / DI patterns
      // that trip up a couple of the stricter recommended rules.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // Frontend (React + Vite, browser runtime)
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
