import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Socket } from 'socket.io-client';
import { RealtimeContext, type RealtimeContextValue } from './RealtimeContext';
import { useHouseholdRoom } from './useHouseholdRoom';

function makeFakeSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
}

function renderWithSocket(householdId: string | undefined, socket: unknown) {
  const value: RealtimeContextValue = { socket: socket as Socket, isConnected: true };
  return renderHook(() => useHouseholdRoom(householdId), {
    wrapper: ({ children }) => (
      <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
    ),
  });
}

describe('useHouseholdRoom', () => {
  it('emits joinHousehold on mount when householdId and socket are available', () => {
    const socket = makeFakeSocket();

    renderWithSocket('household-1', socket);

    expect(socket.emit).toHaveBeenCalledWith('joinHousehold', { householdId: 'household-1' });
  });

  it('emits leaveHousehold with the same householdId on unmount', () => {
    const socket = makeFakeSocket();

    const { unmount } = renderWithSocket('household-1', socket);
    unmount();

    expect(socket.emit).toHaveBeenCalledWith('leaveHousehold', { householdId: 'household-1' });
  });

  it('leaves the old household and joins the new one when householdId changes', () => {
    const socket = makeFakeSocket();
    const value: RealtimeContextValue = { socket: socket as unknown as Socket, isConnected: true };

    const { rerender } = renderHook(({ householdId }) => useHouseholdRoom(householdId), {
      initialProps: { householdId: 'household-1' as string | undefined },
      wrapper: ({ children }) => (
        <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
      ),
    });
    expect(socket.emit).toHaveBeenCalledWith('joinHousehold', { householdId: 'household-1' });

    rerender({ householdId: 'household-2' });

    expect(socket.emit).toHaveBeenCalledWith('leaveHousehold', { householdId: 'household-1' });
    expect(socket.emit).toHaveBeenCalledWith('joinHousehold', { householdId: 'household-2' });
  });

  it('re-joins the room on every socket reconnect', () => {
    const socket = makeFakeSocket();

    renderWithSocket('household-1', socket);

    // useHouseholdRoom registers its own 'connect' listener to re-join on
    // reconnect (see its doc comment) — find and invoke it directly, same
    // as simulating the socket firing a real reconnect.
    const connectCall = socket.on.mock.calls.find(([event]) => event === 'connect');
    expect(connectCall).toBeDefined();
    const reconnectHandler = connectCall![1] as () => void;

    socket.emit.mockClear();
    reconnectHandler();

    expect(socket.emit).toHaveBeenCalledWith('joinHousehold', { householdId: 'household-1' });
  });

  it('does not emit anything when householdId is undefined', () => {
    const socket = makeFakeSocket();

    renderWithSocket(undefined, socket);

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('does not emit anything when there is no socket yet', () => {
    const { unmount } = renderHook(() => useHouseholdRoom('household-1'), {
      wrapper: ({ children }) => (
        <RealtimeContext.Provider value={{ socket: null, isConnected: false }}>
          {children}
        </RealtimeContext.Provider>
      ),
    });

    unmount();
    // No assertion target (no socket to inspect) — this test's purpose is
    // just that the hook doesn't throw when socket is null.
  });
});
