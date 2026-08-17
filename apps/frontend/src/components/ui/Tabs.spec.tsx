import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

function renderTabs() {
  return render(
    <>
      <button type="button">before</button>
      <Tabs defaultValue="feeding">
        <Tabs.List>
          <Tabs.Tab value="feeding">Feeding</Tabs.Tab>
          <Tabs.Tab value="sleep">Sleep</Tabs.Tab>
          <Tabs.Tab value="diaper">Diaper</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="feeding">Feeding content</Tabs.Panel>
        <Tabs.Panel value="sleep">Sleep content</Tabs.Panel>
        <Tabs.Panel value="diaper">Diaper content</Tabs.Panel>
      </Tabs>
    </>,
  );
}

describe('Tabs', () => {
  it('renders a tablist with the default tab selected and its panel visible', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Feeding' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Feeding content');
    expect(screen.queryByText('Sleep content')).not.toBeInTheDocument();
  });

  it('is a single tab stop: Tab enters on the selected tab, not on every tab', async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('button', { name: 'before' }).focus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Feeding' })).toHaveFocus();

    // A second Tab leaves the tab list entirely rather than stepping through
    // the remaining tabs (those are reached with the arrow keys instead).
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Sleep' })).not.toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Diaper' })).not.toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('switches panel when a tab is clicked', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole('tab', { name: 'Sleep' }));

    expect(screen.getByRole('tab', { name: 'Sleep' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Sleep content');
  });

  it('moves focus and activates the next tab on ArrowRight (automatic activation)', async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Feeding' }).focus();

    await user.keyboard('{ArrowRight}');

    const sleepTab = screen.getByRole('tab', { name: 'Sleep' });
    expect(sleepTab).toHaveFocus();
    expect(sleepTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Sleep content');
  });

  it('wraps focus from the first tab to the last on ArrowLeft', async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Feeding' }).focus();

    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('tab', { name: 'Diaper' })).toHaveFocus();
  });

  it('associates each panel with its tab via aria-labelledby/aria-controls', () => {
    renderTabs();
    const tab = screen.getByRole('tab', { name: 'Feeding' });
    const panel = screen.getByRole('tabpanel');
    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  });
});
