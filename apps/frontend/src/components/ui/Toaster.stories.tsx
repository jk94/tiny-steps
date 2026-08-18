/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast } from 'sonner';
import { Toaster } from './Toaster';
import { Button } from './Button';

const meta = {
  title: 'Components/Toaster',
  component: Toaster,
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo() {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Button
        variant="secondary"
        onClick={() => toast('Heads up', { description: 'Just so you know.' })}
      >
        Neutral
      </Button>
      <Button onClick={() => toast.success('Saved', { description: 'Your entry was saved.' })}>
        Success
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.info('Syncing', { description: 'Catching up on offline entries.' })}
      >
        Info
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.warning('Still offline', { description: 'Entries are queued locally.' })
        }
      >
        Warning
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          toast.error('Save failed', { description: "This entry hasn't reached the server." })
        }
      >
        Error
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          toast('Waiting for you', { description: 'Stays until dismissed.', duration: Infinity })
        }
      >
        Persistent
      </Button>
    </div>
  );
}

/**
 * `<Toaster />` is mounted once at the app root; every button here just calls
 * the global `toast()` API, with no provider or hook in between.
 */
export const Playground: Story = {
  render: () => (
    <>
      <Toaster />
      <Demo />
    </>
  ),
};
