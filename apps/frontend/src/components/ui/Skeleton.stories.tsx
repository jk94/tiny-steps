/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rect: Story = {
  args: { shape: 'rect', className: 'h-24 w-64' },
};

export const Circle: Story = {
  args: { shape: 'circle', className: 'h-12 w-12' },
};

export const TextLines: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '16rem' }}>
      <Skeleton shape="text" />
      <Skeleton shape="text" className="w-3/4" />
      <Skeleton shape="text" className="w-1/2" />
    </div>
  ),
};
