/* @dsCard group="Components" */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sheet } from './Sheet';
import { Button } from './Button';

const meta = {
  title: 'Components/Sheet',
  component: Sheet,
  tags: ['autodocs'],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open menu</Button>
      <Sheet isOpen={open} onOpenChange={setOpen} aria-label="Main menu">
        <nav className="flex flex-col gap-1">
          <a href="#dashboard" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
            Dashboard
          </a>
          <a href="#households" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
            Households
          </a>
          <a href="#profile" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
            Profile
          </a>
        </nav>
      </Sheet>
    </>
  );
}

export const Controlled: Story = {
  // `render` ignores `args` entirely; they're supplied only to satisfy
  // `Meta<typeof Sheet>`'s required-props type.
  args: {
    isOpen: false,
    onOpenChange: () => {},
    children: null,
  },
  render: () => <ControlledSheetDemo />,
};

function BottomSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open quick add</Button>
      <Sheet isOpen={open} onOpenChange={setOpen} side="bottom" title="Quick add">
        <div className="grid grid-cols-3 gap-3">
          {['Feeding', 'Sleep', 'Diaper'].map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-lg bg-secondary px-3 py-6 text-sm font-semibold hover:bg-accent"
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export const BottomWithTitle: Story = {
  args: {
    isOpen: false,
    onOpenChange: () => {},
    children: null,
  },
  render: () => <BottomSheetDemo />,
};
