import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AlexaLink } from './AlexaLink';
import * as alexaApi from '../api/alexa-api';
import { ApiError } from '../api/http-client';
import * as useAuthModule from '../auth/useAuth';
import * as navigation from '../lib/navigateToExternalUrl';
import { queryClient } from '../lib/query-client';
import { chooseSelectOption } from '../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

vi.mock('../auth/useAuth');
vi.mock('../lib/navigateToExternalUrl');
vi.mock('../api/alexa-api', async () => {
  const actual = await vi.importActual<typeof alexaApi>('../api/alexa-api');
  return {
    ...actual,
    describeAlexaAuthorization: vi.fn(),
    decideAlexaAuthorization: vi.fn(),
  };
});

stubPopupLayoutApis();

const mockedApi = vi.mocked(alexaApi);
const mockedNavigate = vi.mocked(navigation.navigateToExternalUrl);

const PARAMS = {
  client_id: 'tinysteps-alexa',
  redirect_uri: 'https://pitangui.amazon.com/api/skill/link/M1',
  response_type: 'code',
  state: 'xyz',
};
const EMMA = { id: 'c-emma', name: 'Emma', householdName: 'Müller' };
const PAUL = { id: 'c-paul', name: 'Paul', householdName: 'Müller' };

function renderAt(search: string) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: 'u1', email: 'parent@example.com', name: 'Bernd', createdAt: '' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    updateName: vi.fn(),
    logout: vi.fn(),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/alexa/link${search}`]}>
        <Routes>
          <Route path="/alexa/link" element={<AlexaLink />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const query = `?${new URLSearchParams(PARAMS)}`;

describe('AlexaLink', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('explains an incomplete link without calling the backend', () => {
    renderAt('?client_id=x');

    expect(screen.getByRole('alert')).toHaveTextContent('This link is incomplete.');
    expect(mockedApi.describeAlexaAuthorization).not.toHaveBeenCalled();
  });

  it('shows what Alexa may do and links with the chosen default child', async () => {
    mockedApi.describeAlexaAuthorization.mockResolvedValue({ children: [EMMA, PAUL] });
    mockedApi.decideAlexaAuthorization.mockResolvedValue({
      redirectTo: 'https://pitangui.amazon.com/api/skill/link/M1?code=c&state=xyz',
    });
    const user = userEvent.setup();
    renderAt(query);

    expect(await screen.findByText('log feedings, diapers and sleep')).toBeInTheDocument();
    expect(screen.getByText('Signed in as parent@example.com')).toBeInTheDocument();
    expect(mockedApi.describeAlexaAuthorization).toHaveBeenCalledWith(PARAMS);

    await chooseSelectOption(user, 'Default child for voice commands', 'Paul');
    await user.click(screen.getByRole('button', { name: 'Link' }));

    expect(mockedApi.decideAlexaAuthorization).toHaveBeenCalledWith(PARAMS, true, 'c-paul');
    expect(mockedNavigate).toHaveBeenCalledWith(
      'https://pitangui.amazon.com/api/skill/link/M1?code=c&state=xyz',
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Returning to the Alexa app');
  });

  it('links without a default child by default', async () => {
    mockedApi.describeAlexaAuthorization.mockResolvedValue({ children: [EMMA, PAUL] });
    mockedApi.decideAlexaAuthorization.mockResolvedValue({ redirectTo: 'https://x.example/' });
    const user = userEvent.setup();
    renderAt(query);

    await user.click(await screen.findByRole('button', { name: 'Link' }));

    expect(mockedApi.decideAlexaAuthorization).toHaveBeenCalledWith(PARAMS, true, null);
  });

  it('names the only child instead of offering a picker', async () => {
    mockedApi.describeAlexaAuthorization.mockResolvedValue({ children: [EMMA] });
    renderAt(query);

    expect(
      await screen.findByText('Voice commands without a name refer to Emma.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('sends a cancellation back to Alexa', async () => {
    mockedApi.describeAlexaAuthorization.mockResolvedValue({ children: [] });
    mockedApi.decideAlexaAuthorization.mockResolvedValue({
      redirectTo: 'https://pitangui.amazon.com/api/skill/link/M1?error=access_denied&state=xyz',
    });
    const user = userEvent.setup();
    renderAt(query);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(mockedApi.decideAlexaAuthorization).toHaveBeenCalledWith(PARAMS, false, null);
    expect(mockedNavigate).toHaveBeenCalledWith(expect.stringContaining('error=access_denied'));
  });

  it('explains a redirect URI missing from config.yml', async () => {
    mockedApi.describeAlexaAuthorization.mockRejectedValue(
      new ApiError(400, { code: 'INVALID_REDIRECT_URI' }),
    );
    renderAt(query);

    expect(await screen.findByRole('alert')).toHaveTextContent('redirectUris');
    expect(screen.queryByRole('button', { name: 'Link' })).not.toBeInTheDocument();
  });

  it('shows an error and stays when linking fails', async () => {
    mockedApi.describeAlexaAuthorization.mockResolvedValue({ children: [EMMA] });
    mockedApi.decideAlexaAuthorization.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderAt(query);

    await user.click(await screen.findByRole('button', { name: 'Link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Linking failed.');
    expect(mockedNavigate).not.toHaveBeenCalled();
  });
});
