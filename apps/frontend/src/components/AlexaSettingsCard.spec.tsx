import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { AlexaSettingsCard } from './AlexaSettingsCard';
import * as alexaApi from '../api/alexa-api';
import type { AlexaLinksOverview } from '../api/alexa-api';
import { queryClient } from '../lib/query-client';
import { chooseSelectOption } from '../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

vi.mock('../api/alexa-api');
stubPopupLayoutApis();

const mockedApi = vi.mocked(alexaApi);

// jsdom doesn't implement `HTMLDialogElement.showModal()`/`.close()` — see
// `components/ConfirmDialog.spec.tsx`.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
});

const overview: AlexaLinksOverview = {
  enabled: true,
  links: [
    {
      id: 'l1',
      createdAt: '2026-10-01T10:00:00.000Z',
      lastUsedAt: null,
      defaultChildId: null,
    },
  ],
  children: [
    { id: 'c-emma', name: 'Emma', householdName: 'Müller' },
    { id: 'c-paul', name: 'Paul', householdName: 'Schmidt' },
  ],
};

function renderCard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AlexaSettingsCard />
    </QueryClientProvider>,
  );
}

describe('AlexaSettingsCard', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders nothing when the instance has no Alexa configured', async () => {
    mockedApi.fetchAlexaLinks.mockResolvedValue({ enabled: false, links: [], children: [] });

    const { container } = renderCard();

    await waitFor(() => expect(mockedApi.fetchAlexaLinks).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says when no Amazon account is linked yet', async () => {
    mockedApi.fetchAlexaLinks.mockResolvedValue({ ...overview, links: [] });
    renderCard();
    expect(await screen.findByText('No Amazon account linked yet.')).toBeInTheDocument();
  });

  it('lists a link and saves a new default child', async () => {
    mockedApi.fetchAlexaLinks.mockResolvedValue(overview);
    mockedApi.updateAlexaLinkDefaultChild.mockResolvedValue({
      ...overview.links[0],
      defaultChildId: 'c-paul',
    });
    const user = userEvent.setup();
    renderCard();

    expect(await screen.findByRole('heading', { name: 'Alexa' })).toBeInTheDocument();
    expect(screen.getByText('Not used yet')).toBeInTheDocument();

    // Children from two households carry the household name.
    await chooseSelectOption(user, 'Default child', 'Paul (Schmidt)');

    expect(mockedApi.updateAlexaLinkDefaultChild).toHaveBeenCalledWith('l1', 'c-paul');
    expect(await screen.findByRole('status')).toHaveTextContent('Default child saved.');
  });

  it('unlinks after confirmation', async () => {
    mockedApi.fetchAlexaLinks.mockResolvedValue(overview);
    mockedApi.deleteAlexaLink.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Unlink' }));
    expect(screen.getByText('Unlink Alexa?')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Unlink' });
    await user.click(buttons[buttons.length - 1]);

    expect(mockedApi.deleteAlexaLink).toHaveBeenCalledWith('l1');
    await waitFor(() => expect(mockedApi.fetchAlexaLinks).toHaveBeenCalledTimes(2));
  });

  it('shows an error when the links cannot be loaded', async () => {
    mockedApi.fetchAlexaLinks.mockRejectedValue(new Error('boom'));
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The Alexa links couldn't be loaded.",
    );
  });
});
