import { AlexaApiClient, alexaApiOrigin, type AlexaReminderRequest } from './alexa-api.client';
import type { AlexaSystem } from './alexa-request.types';

const DEVICE_ID = 'amzn1.ask.device.AAAA-test_1';

function system(overrides: Partial<AlexaSystem> = {}): AlexaSystem {
  return {
    application: { applicationId: 'amzn1.ask.skill.test' },
    user: { userId: 'amzn1.ask.account.test' },
    device: { deviceId: DEVICE_ID },
    apiEndpoint: 'https://api.eu.amazonalexa.com',
    apiAccessToken: 'api-token',
    ...overrides,
  };
}

const reminder: AlexaReminderRequest = {
  requestTime: '2026-11-01T13:00:00.000',
  trigger: { type: 'SCHEDULED_RELATIVE', offsetInSeconds: 600 },
  alertInfo: { spokenInfo: { content: [{ locale: 'de-DE', text: 'Zeit, Emma zu füttern.' }] } },
  pushNotification: { status: 'ENABLED' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('alexaApiOrigin', () => {
  it.each([
    'https://api.amazonalexa.com',
    'https://api.eu.amazonalexa.com',
    'https://api.fe.amazonalexa.com',
    'https://api.eu.amazonalexa.com/',
    'https://API.EU.AMAZONALEXA.COM',
  ])('accepts %s', (endpoint) => {
    expect(alexaApiOrigin(endpoint)).toBe(new URL(endpoint).origin);
  });

  it.each([
    undefined,
    '',
    'http://api.eu.amazonalexa.com',
    'https://api.eu.amazonalexa.com:8443',
    'https://api.xx.amazonalexa.com',
    'https://api.eu.amazonalexa.com.evil.example',
    'https://evil.example/api.eu.amazonalexa.com',
    'https://user:pass@api.eu.amazonalexa.com',
    'https://api.eu.amazonalexa.com/some/path',
    'not a url',
  ])('rejects %p', (endpoint) => {
    expect(alexaApiOrigin(endpoint)).toBeNull();
  });
});

describe('AlexaApiClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('getDeviceTimeZone', () => {
    it('reads the time zone from the regional Settings API and caches it per device', async () => {
      fetchSpy.mockResolvedValue(jsonResponse('Europe/Berlin'));
      const client = new AlexaApiClient();

      expect(await client.getDeviceTimeZone(system())).toBe('Europe/Berlin');
      expect(await client.getDeviceTimeZone(system())).toBe('Europe/Berlin');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        `https://api.eu.amazonalexa.com/v2/devices/${DEVICE_ID}/settings/System.timeZone`,
      );
      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe('Bearer api-token');
    });

    it.each([
      ['a foreign API endpoint', { apiEndpoint: 'https://evil.example' }],
      ['a malformed device ID', { device: { deviceId: '../../v1/alerts/reminders' } }],
      ['no API token', { apiAccessToken: undefined }],
    ])('never calls out for %s', async (_label, overrides) => {
      const client = new AlexaApiClient();

      expect(await client.getDeviceTimeZone(system(overrides))).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('ignores an answer that is not a known time zone', async () => {
      fetchSpy.mockResolvedValue(jsonResponse('Mars/Olympus_Mons'));
      expect(await new AlexaApiClient().getDeviceTimeZone(system())).toBeNull();
    });

    it('returns null when the API fails', async () => {
      fetchSpy.mockRejectedValue(new Error('timeout'));
      expect(await new AlexaApiClient().getDeviceTimeZone(system())).toBeNull();
    });
  });

  describe('createReminder', () => {
    it('posts the reminder to the allow-listed origin', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ alertToken: 't' }, 201));

      const outcome = await new AlexaApiClient().createReminder(
        system({ apiEndpoint: 'https://api.amazonalexa.com' }),
        reminder,
      );

      expect(outcome).toBe('created');
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.amazonalexa.com/v1/alerts/reminders');
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual(reminder);
    });

    it.each([401, 403])('reports a missing permission for HTTP %d', async (status) => {
      fetchSpy.mockResolvedValue(jsonResponse({}, status));
      expect(await new AlexaApiClient().createReminder(system(), reminder)).toBe(
        'permissionMissing',
      );
    });

    it('reports other failures as failed', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ message: 'bad' }, 400));
      expect(await new AlexaApiClient().createReminder(system(), reminder)).toBe('failed');
    });

    it('never calls out for a foreign API endpoint', async () => {
      const outcome = await new AlexaApiClient().createReminder(
        system({ apiEndpoint: 'https://api.eu.amazonalexa.com.evil.example' }),
        reminder,
      );
      expect(outcome).toBe('failed');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
