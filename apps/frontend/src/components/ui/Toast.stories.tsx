/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';
import { Button } from './Button';

const meta = {
  title: 'Components/Toast',
  component: Toast,
  tags: ['autodocs'],
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo() {
  const { toast } = useToast();
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Button
        variant="secondary"
        onClick={() => toast({ title: 'Heads up', description: 'Just so you know.' })}
      >
        Info
      </Button>
      <Button
        onClick={() =>
          toast({ title: 'Saved', description: 'Your entry was saved.', variant: 'success' })
        }
      >
        Success
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          toast({
            title: 'Save failed',
            description: "This entry hasn't reached the server.",
            variant: 'destructive',
          })
        }
      >
        Destructive
      </Button>
    </div>
  );
}

export const Playground: Story = {
  render: () => (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  ),
};
