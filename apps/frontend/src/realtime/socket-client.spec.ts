import { describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { createSocket } from './socket-client';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ id: 'fake-socket' })),
}));

describe('createSocket', () => {
  it('calls io() with no explicit url/path (current origin default) and autoConnect disabled', () => {
    const socket = createSocket();

    expect(io).toHaveBeenCalledWith({ autoConnect: false });
    expect(socket).toEqual({ id: 'fake-socket' });
  });
});
