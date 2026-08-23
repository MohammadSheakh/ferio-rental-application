import { BadRequestException } from '@nestjs/common';
import { TransactionalMessagingService } from './transactional-messaging.service';

describe('TransactionalMessagingService templates', () => {
  const actor = { userId: 'admin-1', role: 'admin' } as never;

  function setup() {
    const current = {
      key: 'order-placed',
      eventType: 'ORDER_PLACED',
      enabled: true,
      subjectTemplate: 'Order {{reference}} received',
      bodyTemplate: 'Order {{reference}} received.',
      version: 2,
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const update = jest.fn(async ({ data }) => ({
      ...current,
      ...data,
      version: current.version + 1,
      updatedById: actor.userId,
    }));
    const messageUpsert = jest.fn().mockResolvedValue({ id: 'message-1' });
    const prisma = {
      commerceMessage: { upsert: messageUpsert },
      commerceMessageTemplate: {
        upsert: jest.fn().mockResolvedValue(current),
      },
      $transaction: jest.fn(async (callback) =>
        callback({ commerceMessageTemplate: { update } }),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    return {
      service: new TransactionalMessagingService(
        prisma as never,
        audit as never,
        {} as never,
      ),
      update,
      messageUpsert,
      audit,
    };
  }

  it('increments the version and audits a valid template update', async () => {
    const { service, update, audit } = setup();
    const result = await service.updateTemplate(
      'order-placed',
      { bodyTemplate: 'Order {{reference}} totals {{currency}} {{total}}.' },
      actor,
    );

    expect(result.version).toBe(3);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSACTIONAL_MESSAGE_TEMPLATE_UPDATED',
      }),
      expect.anything(),
    );
  });

  it('rejects placeholders not approved for the event', async () => {
    const { service } = setup();
    await expect(
      service.updateTemplate(
        'order-placed',
        { bodyTemplate: 'Hello {{customerPassword}}' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('copies the rendered template version into the durable message', async () => {
    const { service, messageUpsert } = setup();
    await service.enqueueAfterCommit({
      eventType: 'ORDER_PLACED',
      recipient: '+8801712345678',
      referenceType: 'Order',
      referenceId: 'order-1',
      payload: { reference: 'FER-42' },
    });

    expect(messageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          templateKey: 'order-placed',
          templateVersion: 2,
          renderedSubject: 'Order FER-42 received',
          renderedBody: 'Order FER-42 received.',
        }),
      }),
    );
  });
});
