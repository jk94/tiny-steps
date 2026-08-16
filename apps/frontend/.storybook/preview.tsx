import type { Preview } from '@storybook/react-vite';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n';
// Import the app's real stylesheet so the generated design tokens and Tailwind
// utilities are live in every story (see ADR-0013).
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // addon-a11y: surface violations in the panel without failing the build.
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <Story />
      </I18nextProvider>
    ),
  ],
};

export default preview;
