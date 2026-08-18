import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AuthContextValue } from '../auth/AuthContext';
import { useAuth } from '../auth/useAuth';
import { queryClient } from '../lib/query-client';
import { RealtimeProvider } from './RealtimeProvider';
import { createSocket } from './socket-client';
import { useRealtimeConnection } from './useRealtimeConnection';

vi.mock('../auth/useAuth');
vi.mock('./socket-client');

const mockedUseAuth = vi.mocked(useAuth);
const mockedCreateSocket = vi.mocked(createSocket);

type Listener = (...args: unknown[]) => void;

/**
 * A minimal fake matching only the `socket.io-client` `Socket` surface
 * `RealtimeProvider`/`useHouseholdRoom` actually use. `emit` is a pure
 * outgoing spy (mirrors the real client — calling `.emit()` sends to the
 * server, it does NOT itself invoke local `.on()` listeners); `trigger` is
 * the test-only way to simulate the server/client pushing an incoming
 * event (`connect`/`disconnect`/`event:changed`/...).
 */
function createFakeSocket() {
  const listeners = new Map<string, Set<Listener>>();

  const socket = {
    on: vi.fn((event: string, cb: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(cb);
      return socket;
    }),
    off: vi.fn((event: string, cb: Listener) => {
      listeners.get(event)?.delete(cb);
      return socket;
    }),
    emit: vi.fn(() => socket),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const trigger = (event: string, ...args: unknown[]) => {
    listeners.get(event)?.forEach((cb) => cb(...args));
  };

  return { socket, trigger };
}

function mockAuth(isAuthenticated: boolean) {
  mockedUseAuth.mockReturnValue({
    user: isAuthenticated ? { id: 'u1', email: 'parent@example.com', createdAt: '' } : null,
    isAuthenticated,
    isLoading: false,
    error: undefined,
    login: vi.fn(),
    register: vi.fn(),
    updateName: vi.fn(),
    logout: vi.fn(),
  } as AuthContextValue);
}

function renderRealtimeConnection() {
  function wrapper({ children }: { children: ReactNode }) {
    return <RealtimeProvider>{children}</RealtimeProvider>;
  }
  return renderHook(() => useRealtimeConnection(), { wrapper });
}

describe('RealtimeProvider / useRealtimeConnection', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('constructs the socket exactly once but does not connect() it while unauthenticated', () => {
    mockAuth(false);
    const { socket: fakeSocket } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);

    const { result } = renderRealtimeConnection();

    expect(mockedCreateSocket).toHaveBeenCalledTimes(1);
    expect(fakeSocket.connect).not.toHaveBeenCalled();
    expect(result.current.socket).toBe(fakeSocket);
    expect(result.current.isConnected).toBe(false);
  });

  it('connects the socket once authenticated, and isConnected toggles true on connect', () => {
    mockAuth(true);
    const { socket: fakeSocket, trigger } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);

    const { result } = renderRealtimeConnection();

    expect(mockedCreateSocket).toHaveBeenCalledTimes(1);
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
    expect(result.current.socket).toBe(fakeSocket);
    expect(result.current.isConnected).toBe(false);

    act(() => trigger('connect'));

    expect(result.current.isConnected).toBe(true);
  });

  it('isConnected toggles false again on disconnect', () => {
    mockAuth(true);
    const { socket: fakeSocket, trigger } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);

    const { result } = renderRealtimeConnection();
    act(() => trigger('connect'));
    expect(result.current.isConnected).toBe(true);

    act(() => trigger('disconnect'));

    expect(result.current.isConnected).toBe(false);
  });

  it('isConnected stays false on connect_error', () => {
    mockAuth(true);
    const { socket: fakeSocket, trigger } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);

    const { result } = renderRealtimeConnection();
    act(() => trigger('connect_error', new Error('boom')));

    expect(result.current.isConnected).toBe(false);
  });

  it('invalidates the households query family on every connect (first connect and reconnects alike)', () => {
    mockAuth(true);
    const { socket: fakeSocket, trigger } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderRealtimeConnection();
    act(() => trigger('connect'));
    act(() => trigger('disconnect'));
    act(() => trigger('connect'));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households'] });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('invalidates the matching event-type query-key family on event:changed', () => {
    mockAuth(true);
    const { socket: fakeSocket, trigger } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderRealtimeConnection();
    act(() =>
      trigger('event:changed', {
        type: 'DIAPER',
        action: 'created',
        eventId: 'event-1',
        childId: 'child-1',
        householdId: 'household-1',
      }),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', 'household-1', 'children', 'child-1', 'diaper-events'],
    });
  });

  it('also invalidates the type-independent events query-key family on event:changed, so the daily timeline/stats stay live', () => {
    mockAuth(true);
    const { socket: fakeSocket, trigger } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderRealtimeConnection();
    act(() =>
      trigger('event:changed', {
        type: 'DIAPER',
        action: 'created',
        eventId: 'event-1',
        childId: 'child-1',
        householdId: 'household-1',
      }),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', 'household-1', 'children', 'child-1', 'events'],
    });
  });

  it('disconnects (without discarding) the socket when auth flips to unauthenticated (logout)', () => {
    mockAuth(true);
    const { socket: fakeSocket } = createFakeSocket();
    mockedCreateSocket.mockReturnValue(fakeSocket as never);

    function wrapper({ children }: { children: ReactNode }) {
      return <RealtimeProvider>{children}</RealtimeProvider>;
    }
    const { result, rerender } = renderHook(() => useRealtimeConnection(), { wrapper });
    expect(result.current.socket).toBe(fakeSocket);
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);

    mockAuth(false);
    rerender();

    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
    // The same instance stays in context (see RealtimeProvider's doc
    // comment) — only its live connection state changes.
    expect(result.current.socket).toBe(fakeSocket);
    expect(mockedCreateSocket).toHaveBeenCalledTimes(1);
  });

  it('throws when useRealtimeConnection is called outside a RealtimeProvider', () => {
    expect(() => renderHook(() => useRealtimeConnection())).toThrow(
      'useRealtimeConnection must be used within a RealtimeProvider',
    );
  });
});
