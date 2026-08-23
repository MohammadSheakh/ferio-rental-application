import type { Socket } from 'socket.io';

import { SocketAuthService } from './socket-auth.service';

const guestId = 'gst_123e4567-e89b-42d3-a456-426614174000';

function socket(auth: Record<string, unknown>): Socket {
  return {
    id: 'socket-12345678',
    handshake: { auth, headers: {}, query: {} },
  } as unknown as Socket;
}

describe('SocketAuthService', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
  };
  const redis = {};
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  let service: SocketAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SocketAuthService(jwtService as never, redis as never, prisma as never);
  });

  it('never grants admin access from handshake role fields', async () => {
    const result = await service.authenticateSocket(
      socket({ role: 'admin', guestId }),
    );

    expect(result).toEqual({
      userId: guestId,
      role: 'guest',
      name: 'Guest Visitor',
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens instead of falling back to a claimed role', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(
      service.authenticateSocket(socket({ token: 'invalid', role: 'admin', guestId })),
    ).resolves.toBeNull();
  });

  it('uses the database role for authenticated accounts', async () => {
    jwtService.verifyAsync.mockResolvedValue({ userId: 'user-1', role: 'admin' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
      name: 'Customer',
    });

    await expect(
      service.authenticateSocket(socket({ token: 'signed-token' })),
    ).resolves.toEqual({ userId: 'user-1', role: 'user', name: 'Customer' });
  });

  it('limits guests to their own raw and prefixed conversation rooms', async () => {
    const user = { userId: guestId, role: 'guest', name: 'Guest Visitor' };

    await expect(service.canAccessConversation(user, guestId)).resolves.toBe(true);
    await expect(service.canAccessConversation(user, `conv-${guestId}`)).resolves.toBe(true);
    await expect(
      service.canAccessConversation(user, 'conv-gst_123e4567-e89b-42d3-a456-426614174999'),
    ).resolves.toBe(false);
  });

  it('allows authenticated customers to use their linked customer room', async () => {
    prisma.user.findUnique.mockResolvedValue({ customerId: 'customer-1' });
    const user = { userId: 'user-1', role: 'user', name: 'Customer' };

    await expect(
      service.canAccessConversation(user, 'conv-customer-1'),
    ).resolves.toBe(true);
    await expect(
      service.canAccessConversation(user, 'conv-customer-2'),
    ).resolves.toBe(false);
  });

  it('allows verified administrators to access support conversations', async () => {
    const user = { userId: 'admin-1', role: 'admin', name: 'Admin' };

    await expect(
      service.canAccessConversation(user, `conv-${guestId}`),
    ).resolves.toBe(true);
  });
});
