/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  args: { label: 'Feeding type', placeholder: 'Choose a type…' },
  render: (args) => (
    <Select {...args}>
      <Select.Item value="BREAST">Breastfeeding</Select.Item>
      <Select.Item value="BOTTLE">Bottle</Select.Item>
      <Select.Item value="SOLID">Solid food</Select.Item>
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: null } };

export const WithSelectedValue: Story = {
  args: { children: null, defaultValue: 'BOTTLE' },
};

export const WithError: Story = {
  args: { children: null, error: 'Please choose a feeding type.' },
};

export const Disabled: Story = {
  args: { children: null, defaultValue: 'BREAST', disabled: true },
};

/** An individual choice can be disabled without disabling the whole field. */
export const WithDisabledItem: Story = {
  args: { children: null },
  render: (args) => (
    <Select {...args}>
      <Select.Item value="BREAST">Breastfeeding</Select.Item>
      <Select.Item value="BOTTLE">Bottle</Select.Item>
      <Select.Item value="SOLID" disabled>
        Solid food (not yet started)
      </Select.Item>
    </Select>
  ),
};
