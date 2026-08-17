import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type User = ReturnType<typeof userEvent.setup>;

/**
 * Picks an option from a design-system `<Select>`.
 *
 * The primitive is a Radix combobox, not a native `<select>`, so its options
 * only exist in the DOM while the listbox is open — `user.selectOptions()`
 * does not apply. This helper encapsulates the open-then-click sequence so
 * specs read as one intent-level step.
 *
 * Requires `stubPopupLayoutApis()` in the calling spec file, since Radix
 * measures its popper with APIs jsdom lacks.
 */
export async function chooseSelectOption(
  user: User,
  fieldName: string | RegExp,
  optionName: string | RegExp,
): Promise<void> {
  await user.click(await screen.findByRole('combobox', { name: fieldName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}
