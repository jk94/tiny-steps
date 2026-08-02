import { describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { createSocket } from './socket-client';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ id: 'fake-socket' })),
}));

describe('createSocket', () => {
  it('calls io() with no explicit url (current origin default), the /api-scoped socket.io path, and autoConnect disabled', () => {
    const socket = createSocket();

    expect(io).toHaveBeenCalledWith({ autoConnect: false, path: '/api/socket.io' });
    expect(socket).toEqual({ id: 'fake-socket' });
  });
});
