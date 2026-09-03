import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked so the SUT never touches the real Capacitor plugins. Factories run
// fresh after each `vi.resetModules()`, giving each test isolated mock state
// (important because the SUT has a module-level once-per-session guard).
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
}));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));
vi.mock('../api/push-api', () => ({ registerPushToken: vi.fn().mockResolvedValue(undefined) }));

async function loadModule() {
  vi.resetModules();
  const { Capacitor } = await import('@capacitor/core');
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const pushApi = await import('../api/push-api');
  const deepLinkStore = await import('./deepLinkStore');
  const { registerPushNotifications } = await import('./registerPushNotifications');
  return { Capacitor, PushNotifications, pushApi, deepLinkStore, registerPushNotifications };
}

/**
 * Grabs the callback the SUT registered for one native event. `addListener`'s
 * real type is overloaded per event name and `Parameters<>` only sees the last
 * overload, so this routes through `unknown` rather than fighting the
 * inference — same approach as the registration tests below.
 */
function listenerFor<T>(
  addListener: { mock: { calls: unknown[][] } },
  event: string,
): (payload: T) => void {
  const call = addListener.mock.calls.find(([name]) => (name as string) === event);
  expect(call).toBeDefined();
  return call![1] as (payload: T) => void;
}

describe('registerPushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a no-op in a non-native (browser/PWA) build', async () => {
    const { Capacitor, PushNotifications, registerPushNotifications } = await loadModule();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await registerPushNotifications();

    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(PushNotifications.register).not.toHaveBeenCalled();
  });

  it('registers and forwards the token to the backend when permission is granted', async () => {
    const { Capacitor, PushNotifications, pushApi, registerPushNotifications } = await loadModule();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
    vi.mocked(PushNotifications.register).mockResolvedValue(undefined);

    await registerPushNotifications();

    expect(PushNotifications.register).toHaveBeenCalledTimes(1);

    // Simulate the native `registration` event firing with a token.
    // `addListener`'s real type is overloaded per event name; TS's
    // `Parameters<>` on an overloaded function only sees the last overload,
    // so the event/callback types here don't match what we actually mocked
    // — route through `unknown` rather than fight the overload inference.
    const registrationCall = vi
      .mocked(PushNotifications.addListener)
      .mock.calls.find(([event]) => (event as unknown as string) === 'registration');
    expect(registrationCall).toBeDefined();
    const registrationCallback = registrationCall![1] as unknown as (token: {
      value: string;
    }) => void;
    registrationCallback({ value: 'fcm-token-123' });

    expect(pushApi.registerPushToken).toHaveBeenCalledWith('fcm-token-123', 'ANDROID');
  });

  it('maps the iOS platform when registering the token', async () => {
    const { Capacitor, PushNotifications, pushApi, registerPushNotifications } = await loadModule();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
    vi.mocked(PushNotifications.register).mockResolvedValue(undefined);

    await registerPushNotifications();

    const registrationCallback = vi
      .mocked(PushNotifications.addListener)
      .mock.calls.find(
        ([event]) => (event as unknown as string) === 'registration',
      )![1] as unknown as (token: { value: string }) => void;
    registrationCallback({ value: 'apns-token' });

    expect(pushApi.registerPushToken).toHaveBeenCalledWith('apns-token', 'IOS');
  });

  describe('tapped notification (MED-11)', () => {
    async function registerAndTap(data: Record<string, string> | undefined) {
      const { Capacitor, PushNotifications, deepLinkStore, registerPushNotifications } =
        await loadModule();
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
      vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
      vi.mocked(PushNotifications.register).mockResolvedValue(undefined);

      await registerPushNotifications();
      deepLinkStore.resetDeepLinkStore();

      const onTap = listenerFor<{ notification: { data?: Record<string, string> } }>(
        vi.mocked(PushNotifications.addListener),
        'pushNotificationActionPerformed',
      );
      onTap({ notification: { data } });

      return deepLinkStore;
    }

    it('records the resolved deep link for the navigator to drain', async () => {
      const deepLinkStore = await registerAndTap({
        type: 'MEDICAL_REMINDER',
        householdId: 'h1',
        childId: 'c1',
        healthRecordId: 'r1',
      });

      expect(deepLinkStore.consumePendingDeepLink()).toBe(
        '/households/h1/children/c1/health/r1/edit',
      );
    });

    it('records nothing for a payload it cannot map', async () => {
      // Better to leave the user where they are than to navigate somewhere
      // invented from an unknown payload.
      const deepLinkStore = await registerAndTap({ type: 'SOMETHING_NEW' });

      expect(deepLinkStore.consumePendingDeepLink()).toBeNull();
    });

    it('survives a notification with no data at all', async () => {
      const deepLinkStore = await registerAndTap(undefined);

      expect(deepLinkStore.consumePendingDeepLink()).toBeNull();
    });

    it('leaves a foreground-received notification alone', async () => {
      const { Capacitor, PushNotifications, deepLinkStore, registerPushNotifications } =
        await loadModule();
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
      vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
      vi.mocked(PushNotifications.register).mockResolvedValue(undefined);

      await registerPushNotifications();
      deepLinkStore.resetDeepLinkStore();

      // Receiving is not tapping: yanking the user off their current screen
      // because a push arrived would be hostile.
      const onReceive = listenerFor<{ data?: Record<string, string> }>(
        vi.mocked(PushNotifications.addListener),
        'pushNotificationReceived',
      );
      onReceive({ data: { type: 'MEDICAL_REMINDER', householdId: 'h1', childId: 'c1' } });

      expect(deepLinkStore.consumePendingDeepLink()).toBeNull();
    });
  });

  it('does not register when permission is denied', async () => {
    const { Capacitor, PushNotifications, registerPushNotifications } = await loadModule();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'denied' });

    await registerPushNotifications();

    expect(PushNotifications.register).not.toHaveBeenCalled();
  });

  it('registers only once across repeated calls (session guard)', async () => {
    const { Capacitor, PushNotifications, registerPushNotifications } = await loadModule();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
    vi.mocked(PushNotifications.register).mockResolvedValue(undefined);

    await registerPushNotifications();
    await registerPushNotifications();

    expect(PushNotifications.register).toHaveBeenCalledTimes(1);
  });
});
