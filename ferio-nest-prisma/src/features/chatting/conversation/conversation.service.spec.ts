import { ForbiddenException } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ParticipantRole } from './conversation.constant';

describe('ConversationService participant authorization', () => {
  function createService(actor: { role: string } | null) {
    const prisma = {
      conversationParticipents: {
        findFirst: jest.fn().mockResolvedValue(actor),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const socketGateway = { emitToRoom: jest.fn() };
    const service = new ConversationService(
      prisma as never,
      {} as never,
      socketGateway as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, socketGateway };
  }

  it('rejects participant additions by a non-administrator', async () => {
    const { service, prisma } = createService(null);

    await expect(
      service.addParticipantsToConversation(
        'conversation-1',
        ['user-2'],
        'user-1',
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversationParticipents.create).not.toHaveBeenCalled();
  });

  it('rejects removal of another participant by a member', async () => {
    const { service, prisma } = createService({
      role: ParticipantRole.MEMBER,
    });

    await expect(
      service.removeParticipant('conversation-1', 'user-2', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversationParticipents.updateMany).not.toHaveBeenCalled();
  });

  it('allows a participant to leave their own conversation', async () => {
    const { service, prisma, socketGateway } = createService({
      role: ParticipantRole.MEMBER,
    });

    await expect(
      service.removeParticipant('conversation-1', 'user-1', 'user-1'),
    ).resolves.toBeUndefined();
    expect(prisma.conversationParticipents.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1', userId: 'user-1' },
      data: { isDeleted: true },
    });
    expect(socketGateway.emitToRoom).toHaveBeenCalled();
  });
});
