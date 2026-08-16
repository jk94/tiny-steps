/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Badge' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Semantic: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge {...args} variant="default">
        Default
      </Badge>
      <Badge {...args} variant="success">
        Success
      </Badge>
      <Badge {...args} variant="warning">
        Warning
      </Badge>
      <Badge {...args} variant="destructive">
        Destructive
      </Badge>
    </div>
  ),
};

export const EventTypes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge {...args} variant="feeding">
        Feeding
      </Badge>
      <Badge {...args} variant="feeding-breast">
        Breast
      </Badge>
      <Badge {...args} variant="feeding-bottle">
        Bottle
      </Badge>
      <Badge {...args} variant="feeding-solid">
        Solid
      </Badge>
      <Badge {...args} variant="sleep">
        Sleep
      </Badge>
      <Badge {...args} variant="diaper">
        Diaper
      </Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Badge {...args} size="sm">
        Small
      </Badge>
      <Badge {...args} size="md">
        Medium
      </Badge>
    </div>
  ),
};
