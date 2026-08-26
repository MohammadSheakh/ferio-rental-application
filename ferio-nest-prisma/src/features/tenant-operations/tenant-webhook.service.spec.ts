import { TenantWebhookService } from './tenant-webhook.service';

describe('TenantWebhookService delivery claiming', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('atomically marks due rows PROCESSING before sending', async () => {
    const update = jest.fn().mockResolvedValue({});
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'delivery-1',
          endpointId: 'endpoint-1',
          event: 'invoice.overdue',
          payload: { event: 'invoice.overdue' },
          attempts: 0,
          maxAttempts: 5,
          endpointUrl: 'https://hooks.example.test/ferio',
          endpointSecret: 'secret',
          endpointEnabled: true,
        },
      ]),
      webhookDelivery: { update },
    };
    const manager = { getTenantDatabase: jest.fn().mockResolvedValue(db) };
    global.fetch = jest.fn().mockResolvedValue({ status: 204 }) as never;
    const service = new TenantWebhookService(manager as never, {} as never);

    await service.flushOrganization('org-1');

    const query = db.$queryRaw.mock.calls[0][0];
    expect(query.strings.join(' ')).toContain("SET status = 'PROCESSING'");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'delivery-1' },
        data: expect.objectContaining({ status: 'SUCCESS', attempts: 1 }),
      }),
    );
  });
});
