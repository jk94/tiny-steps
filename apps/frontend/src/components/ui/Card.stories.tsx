/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Button } from './Button';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  render: () => (
    <Card style={{ maxWidth: '20rem' }}>
      <Card.Header>
        <strong>Last feeding</strong>
        <span style={{ color: 'var(--color-muted-foreground)' }}>Breastfeeding (left)</span>
      </Card.Header>
      <Card.Body>2 hours ago · 12 min</Card.Body>
      <Card.Footer>
        <Button size="sm" variant="secondary">
          Details
        </Button>
      </Card.Footer>
    </Card>
  ),
};

export const BodyOnly: Story = {
  render: () => (
    <Card style={{ maxWidth: '20rem' }}>
      <Card.Body>A simple card with only a body slot.</Card.Body>
    </Card>
  ),
};
