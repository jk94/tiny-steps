/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: { label: 'Note', placeholder: 'Optional note…', rows: 3 },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: 'The note must be at most 500 characters long.', defaultValue: 'x'.repeat(501) },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Slight rash after this change.' },
};
