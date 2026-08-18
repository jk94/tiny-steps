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
      <Dialog isOpen={open} onOpenChange={setOpen}>
        <Dialog.Header>
          <Dialog.Title>Delete entry?</Dialog.Title>
          <Dialog.Description>This action can&apos;t be undone.</Dialog.Description>
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

/** `render` ignores these; they exist only to satisfy `Meta<typeof Dialog>`'s required props. */
const placeholderArgs = {
  isOpen: false,
  onOpenChange: () => {},
  children: null,
};

export const Controlled: Story = {
  args: placeholderArgs,
  render: () => <ControlledDialogDemo />,
};

function BlockingDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open blocking dialog</Button>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        hideCloseButton
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <Dialog.Header>
          <Dialog.Title>One more thing</Dialog.Title>
          <Dialog.Description>
            There is no ✕ and ESC does nothing — the only way out is the action below.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Button variant="primary" onClick={() => setOpen(false)}>
            Continue
          </Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}

/** A dialog the user must act on: no ✕, no ESC, no backdrop dismissal. */
export const Blocking: Story = {
  args: placeholderArgs,
  render: () => <BlockingDialogDemo />,
};
