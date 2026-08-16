/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inbox } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIconAndDescription: Story = {
  args: {
    icon: <Inbox size={40} />,
    title: 'No feedings yet',
    description: 'Log the first feeding and it will show up here.',
  },
};

export const WithAction: Story = {
  args: {
    icon: <Inbox size={40} />,
    title: 'No children yet',
    description: 'Add a child profile to start tracking.',
    action: <Button>Add child</Button>,
  },
};
