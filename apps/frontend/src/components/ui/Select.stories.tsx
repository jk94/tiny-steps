/* @dsCard group="Components" */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  args: { label: 'Feeding type' },
  render: (args) => (
    <Select {...args}>
      <option value="" disabled>
        Choose a type…
      </option>
      <option value="BREAST">Breastfeeding</option>
      <option value="BOTTLE">Bottle</option>
      <option value="SOLID">Solid food</option>
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { defaultValue: '' } };

export const WithError: Story = {
  args: { defaultValue: '', error: 'Please choose a feeding type.' },
};

export const Disabled: Story = { args: { defaultValue: 'BREAST', disabled: true } };
