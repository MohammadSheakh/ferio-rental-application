import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderShipmentStatus,
  PrismaClient,
  ShipmentProviderCode,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { PrismaService } from '@app/database';
import { AuditService } from '../src/features/audit/audit.service';
import { PathaoAdapter } from '../src/features/shipping/adapters/pathao.adapter';
import { SteadfastAdapter } from '../src/features/shipping/adapters/steadfast.adapter';
import { ShippingService } from '../src/features/shipping/shipping.service';
import { ShippingPollingService } from '../src/features/shipping/shipping-polling.service';
import { TransactionalMessagingService } from '../src/features/transactional-messaging/transactional-messaging.service';
import {
  courierWebhookSecrets,
  pathaoWebhookFixture,
  pathaoWebhookHeaders,
  steadfastWebhookFixture,
  steadfastWebhookHeaders,
} from './fixtures/courier-webhooks';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for integration tests');
}
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!/(^test_|_test_|_test$)/.test(databaseName)) {
  throw new Error(
    `Refusing integration tests against non-test database: ${databaseName}`,
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const prismaService = prisma as unknown as PrismaService;
const config = new ConfigService({
  PATHAO_WEBHOOK_SECRET: courierWebhookSecrets.pathao,
  STEADFAST_WEBHOOK_TOKEN: courierWebhookSecrets.steadfast,
});
const audit = new AuditService(prismaService);
const messages = new TransactionalMessagingService(prismaService);
const pathaoAdapter = new PathaoAdapter(config);
const pollShipment = jest.fn();
jest.spyOn(pathaoAdapter, 'isPollingConfigured').mockReturnValue(true);
pathaoAdapter.pollShipment = pollShipment;
const shipping = new ShippingService(
  prismaService,
  pathaoAdapter,
  new SteadfastAdapter(config),
  messages,
  audit,
);
const polling = new ShippingPollingService(prismaService, shipping);

describe('Courier webhook PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    pollShipment.mockReset();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditLog",
        "Customer",
        "Cart",
        "DeliveryZone",
        "ShipmentProvider",
        "ShipmentWebhookLog"
      CASCADE
    `);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('retains rejected auth without poisoning the valid Pathao event', async () => {
    await createShipmentFixture('pathao-auth', 'PATHAO', 'CREATED');
    const payload = pathaoWebhookFixture({
      eventId: 'pathao-auth-event-1',
      consignmentId: 'pathao-auth',
      event: 'order.picked',
      occurredAt: '2026-08-13T10:00:00.000Z',
    });

    await expect(
      shipping.processWebhook('pathao', pathaoWebhookHeaders.invalid, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const concurrentResults = await Promise.all([
      shipping.processWebhook('pathao', pathaoWebhookHeaders.valid, payload),
      shipping.processWebhook('pathao', pathaoWebhookHeaders.valid, payload),
    ]);
    expect(concurrentResults).toEqual(
      expect.arrayContaining([
        { accepted: true, duplicate: false, applied: true },
      ]),
    );
    expect(concurrentResults.filter((result) => result.duplicate)).toHaveLength(
      1,
    );

    const [logs, shipment, eventCount] = await Promise.all([
      prisma.shipmentWebhookLog.findMany({ orderBy: { receivedAt: 'asc' } }),
      prisma.shipment.findFirstOrThrow({
        where: { externalShipmentId: 'pathao-auth' },
      }),
      prisma.shipmentEvent.count(),
    ]);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        authValid: false,
        processed: false,
        attemptCount: 1,
        processingError: 'Webhook authentication failed',
        headers: expect.objectContaining({
          'x-pathao-merchant-webhook-integration-secret': '[REDACTED]',
        }),
      }),
    );
    expect(logs[1]).toEqual(
      expect.objectContaining({
        authValid: true,
        processed: true,
        attemptCount: 1,
        processingError: null,
      }),
    );
    expect(shipment.status).toBe('PICKED_UP');
    expect(eventCount).toBe(1);

    await expect(
      shipping.processWebhook('PATHAO', pathaoWebhookHeaders.valid, payload),
    ).resolves.toEqual({ accepted: true, duplicate: true });
    await expect(prisma.shipmentEvent.count()).resolves.toBe(1);
    await expect(
      prisma.shipmentWebhookLog.findFirstOrThrow({
        where: { authValid: true },
      }),
    ).resolves.toEqual(expect.objectContaining({ attemptCount: 1 }));
  });

  it('retries one failed Steadfast callback after its shipment appears', async () => {
    await createProvider('STEADFAST');
    const payload = steadfastWebhookFixture({
      consignmentId: 'steadfast-retry',
      trackingCode: 'STEADFAST-RETRY-1',
      status: 'delivered',
      occurredAt: '2026-08-13T11:00:00.000Z',
    });

    await expect(
      shipping.processWebhook(
        'STEADFAST',
        steadfastWebhookHeaders.valid,
        payload,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    const failedLog = await prisma.shipmentWebhookLog.findFirstOrThrow();
    expect(failedLog).toEqual(
      expect.objectContaining({
        processed: false,
        attemptCount: 1,
        processingStartedAt: null,
        processingError: 'Shipment not found for event',
      }),
    );

    await createShipmentFixture(
      'steadfast-retry',
      'STEADFAST',
      'OUT_FOR_DELIVERY',
    );
    await expect(shipping.retryWebhookLog(failedLog.id)).resolves.toEqual({
      accepted: true,
      duplicate: false,
      applied: true,
    });

    const [log, shipment, collection] = await Promise.all([
      prisma.shipmentWebhookLog.findFirstOrThrow(),
      prisma.shipment.findFirstOrThrow({
        where: { externalShipmentId: 'steadfast-retry' },
      }),
      prisma.codCollection.findFirstOrThrow(),
    ]);
    expect(log).toEqual(
      expect.objectContaining({
        processed: true,
        attemptCount: 2,
        processingStartedAt: null,
        processingError: null,
      }),
    );
    expect(shipment.status).toBe('DELIVERED');
    expect(collection.expectedAmount).toBe(150000);
  });

  it('retains but ignores an older Pathao status without regression', async () => {
    await createShipmentFixture('pathao-ordering', 'PATHAO', 'CREATED');
    const current = pathaoWebhookFixture({
      eventId: 'pathao-ordering-event-current',
      consignmentId: 'pathao-ordering',
      event: 'order.in-transit',
      occurredAt: '2026-08-13T12:00:00.000Z',
    });
    const older = pathaoWebhookFixture({
      eventId: 'pathao-ordering-event-older',
      consignmentId: 'pathao-ordering',
      event: 'order.picked',
      occurredAt: '2026-08-13T11:00:00.000Z',
    });

    await expect(
      shipping.processWebhook('PATHAO', pathaoWebhookHeaders.valid, current),
    ).resolves.toEqual({ accepted: true, duplicate: false, applied: true });
    await expect(
      shipping.processWebhook('PATHAO', pathaoWebhookHeaders.valid, older),
    ).resolves.toEqual({ accepted: true, duplicate: false, applied: false });

    const [shipment, events] = await Promise.all([
      prisma.shipment.findFirstOrThrow({
        where: { externalShipmentId: 'pathao-ordering' },
      }),
      prisma.shipmentEvent.findMany({ orderBy: { occurredAt: 'asc' } }),
    ]);
    expect(shipment.status).toBe('IN_TRANSIT');
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(
      expect.objectContaining({
        isOutOfOrder: true,
        ignoredReason: 'Older than the latest accepted event',
      }),
    );
  });

  it('polls through the normalized event pipeline and retains source evidence', async () => {
    const shipment = await createShipmentFixture(
      'pathao-poll-success',
      'PATHAO',
      'CREATED',
    );
    pollShipment.mockResolvedValue(
      pathaoWebhookFixture({
        eventId: 'pathao-poll-event-1',
        consignmentId: 'pathao-poll-success',
        event: 'order.in-transit',
        occurredAt: '2026-08-13T13:00:00.000Z',
      }),
    );

    const attempt = await polling.prepareAttempt(shipment.id, 'admin-1');
    await expect(polling.execute(attempt.id)).resolves.toEqual(
      expect.objectContaining({
        status: 'SUCCEEDED',
        normalizedStatus: 'IN_TRANSIT',
        evidenceLogId: expect.any(String),
      }),
    );

    const [updatedShipment, evidence] = await Promise.all([
      prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } }),
      prisma.shipmentWebhookLog.findFirstOrThrow({
        where: { source: 'POLL' },
      }),
    ]);
    expect(updatedShipment).toEqual(
      expect.objectContaining({
        status: 'IN_TRANSIT',
        pollingFailureCount: 0,
        pollingError: null,
        lastPolledAt: expect.any(Date),
        nextPollAt: expect.any(Date),
      }),
    );
    expect(evidence).toEqual(
      expect.objectContaining({ processed: true, authValid: true }),
    );
  });

  it('retains provider outage evidence and schedules bounded backoff', async () => {
    const shipment = await createShipmentFixture(
      'pathao-poll-outage',
      'PATHAO',
      'CREATED',
    );
    pollShipment.mockRejectedValue(
      new Error('Provider status API unavailable'),
    );

    const attempt = await polling.prepareAttempt(shipment.id);
    await expect(polling.execute(attempt.id)).rejects.toThrow(
      'Provider status API unavailable',
    );

    const [failedAttempt, updatedShipment] = await Promise.all([
      prisma.shipmentPollAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      }),
      prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } }),
    ]);
    expect(failedAttempt).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'PROVIDER_POLL_FAILED',
        errorMessage: 'Provider status API unavailable',
      }),
    );
    expect(updatedShipment).toEqual(
      expect.objectContaining({
        pollingFailureCount: 1,
        pollingError: 'Provider status API unavailable',
        nextPollAt: expect.any(Date),
      }),
    );
    expect(updatedShipment.nextPollAt!.getTime()).toBeGreaterThan(Date.now());
  });
});

async function createProvider(code: ShipmentProviderCode) {
  return prisma.shipmentProvider.upsert({
    where: { code },
    update: {},
    create: {
      code,
      name: code === 'PATHAO' ? 'Pathao' : 'Steadfast',
      baseUrl: `https://${code.toLowerCase()}.example.test`,
      isActive: true,
    },
  });
}

async function createShipmentFixture(
  suffix: string,
  providerCode: ShipmentProviderCode,
  status: OrderShipmentStatus,
) {
  const provider = await createProvider(providerCode);
  const customer = await prisma.customer.create({
    data: {
      name: `Webhook Customer ${suffix}`,
      phoneOriginal: '01700000000',
      phoneNormalized: '+8801700000000',
    },
  });
  const cart = await prisma.cart.create({
    data: {
      tokenHash: `webhook-cart-${suffix}`,
      status: 'CONVERTED',
      expiresAt: new Date('2026-08-14T00:00:00.000Z'),
    },
  });
  const zone = await prisma.deliveryZone.create({
    data: { name: `Webhook Zone ${suffix}`, deliveryFee: 7000 },
  });
  const checkout = await prisma.checkoutDraft.create({
    data: {
      name: `Webhook Customer ${suffix}`,
      phoneOriginal: '01700000000',
      phoneNormalized: '+8801700000000',
      district: 'Dhaka',
      area: 'Dhanmondi',
      detailedAddress: 'Webhook integration address',
      termsAccepted: true,
      subtotal: 143000,
      deliveryFee: 7000,
      total: 150000,
      cartId: cart.id,
      deliveryZoneId: zone.id,
      expiresAt: new Date('2026-08-14T00:00:00.000Z'),
    },
  });
  const order = await prisma.order.create({
    data: {
      reference: `FERIO-${suffix}`,
      idempotencyKeyHash: `webhook-order-${suffix}`,
      status: 'CONFIRMED',
      fulfillmentStatus: 'READY_FOR_HANDOVER',
      shipmentStatus: status,
      codVerification: 'VERIFIED',
      subtotal: 143000,
      deliveryFee: 7000,
      total: 150000,
      customerId: customer.id,
      checkoutDraftId: checkout.id,
    },
  });
  return prisma.shipment.create({
    data: {
      status,
      externalShipmentId: suffix,
      trackingNumber: `${suffix}-tracking`,
      weightGrams: 500,
      codAmount: 150000,
      requestPayload: {},
      createdByActorId: 'webhook-integration-admin',
      orderId: order.id,
      providerId: provider.id,
    },
  });
}
