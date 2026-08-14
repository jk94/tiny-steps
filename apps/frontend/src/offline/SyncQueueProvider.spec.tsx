import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { RealtimeContextValue } from '../realtime/RealtimeContext';
import { useRealtimeConnection } from '../realtime/useRealtimeConnection';
import { SyncQueueProvider } from './SyncQueueProvider';
import { drainPendingEventQueue } from './syncQueue';

vi.mock('../realtime/useRealtimeConnection');
vi.mock('./syncQueue');

const mockedUseRealtimeConnection = vi.mocked(useRealtimeConnection);
const mockedDrain = vi.mocked(drainPendingEventQueue);

function mockConnection(isConnected: boolean): void {
  mockedUseRealtimeConnection.mockReturnValue({
    socket: null,
    isConnected,
  } as RealtimeContextValue);
}

function renderProvider(): void {
  render(
    <SyncQueueProvider>
      <div>child</div>
    </SyncQueueProvider>,
  );
}

describe('SyncQueueProvider', () => {
  beforeEach(() => {
    mockedDrain.mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('drains the queue when the socket is already connected on mount', () => {
    mockConnection(true);

    renderProvider();

    expect(mockedDrain).toHaveBeenCalled();
  });

  it('does not drain while the socket is disconnected', () => {
    mockConnection(false);

    renderProvider();

    expect(mockedDrain).not.toHaveBeenCalled();
  });

  it('drains the queue when the browser fires an online event', () => {
    mockConnection(false);
    renderProvider();
    expect(mockedDrain).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockedDrain).toHaveBeenCalledTimes(1);
  });
});
