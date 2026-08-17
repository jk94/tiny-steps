/* @dsCard group="Components" */
import { useState } from 'react';
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
  // `render` ignores `args`; supplied only to satisfy `Meta<typeof Tabs>`'s
  // required-props type.
  args: {
    defaultValue: 'feeding',
    children: null,
  },
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

function ControlledTabsDemo() {
  const [value, setValue] = useState('feeding');
  return (
    <Tabs defaultValue="feeding" value={value} onValueChange={setValue}>
      <Tabs.List>
        <Tabs.Tab value="feeding">Feeding</Tabs.Tab>
        <Tabs.Tab value="sleep">Sleep</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="feeding">Recent feedings appear here.</Tabs.Panel>
      <Tabs.Panel value="sleep">Recent sleep entries appear here.</Tabs.Panel>
    </Tabs>
  );
}

/** Selection owned by the consumer via `value` + `onValueChange`. */
export const Controlled: Story = {
  // `render` ignores `args`; supplied only to satisfy `Meta<typeof Tabs>`'s
  // required-props type.
  args: {
    defaultValue: 'feeding',
    children: null,
  },
  render: () => <ControlledTabsDemo />,
};
