/* @dsCard group="Components" */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from './Dialog';
import { Button } from './Button';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog isOpen={open} onOpenChange={setOpen} aria-labelledby="story-dialog-title">
        <Dialog.Header>
          <h2 id="story-dialog-title" style={{ margin: 0 }}>
            Delete entry?
          </h2>
          <span style={{ color: 'var(--color-muted-foreground)' }}>
            This action can&apos;t be undone.
          </span>
        </Dialog.Header>
        <Dialog.Body>The entry will be permanently removed for everyone.</Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => setOpen(false)}>
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}

export const Controlled: Story = {
  // `render` ignores `args` entirely; they're supplied only to satisfy
  // `Meta<typeof Dialog>`'s required-props type.
  args: {
    isOpen: false,
    onOpenChange: () => {},
    children: null,
  },
  render: () => <ControlledDialogDemo />,
};
