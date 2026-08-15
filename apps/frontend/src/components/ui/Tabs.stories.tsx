/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="feeding">
      <Tabs.List>
        <Tabs.Tab value="feeding">Feeding</Tabs.Tab>
        <Tabs.Tab value="sleep">Sleep</Tabs.Tab>
        <Tabs.Tab value="diaper">Diaper</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="feeding">Recent feedings appear here.</Tabs.Panel>
      <Tabs.Panel value="sleep">Recent sleep entries appear here.</Tabs.Panel>
      <Tabs.Panel value="diaper">Recent diaper changes appear here.</Tabs.Panel>
    </Tabs>
  ),
};
