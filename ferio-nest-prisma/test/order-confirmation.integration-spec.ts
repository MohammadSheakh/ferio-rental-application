import { ConflictException } from '@nestjs/common';
import type { UserPayload } from '@app/common';
import type { PrismaService } from '@app/database';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AuditService } from '../src/features/audit/audit.service';
import { CartService } from '../src/features/cart/cart.service';
import { CatalogService } from '../src/features/catalog/catalog.service';
import { OrderService } from '../src/features/order/order.service';
import { TransactionalMessagingService } from '../src/features/transactional-messaging/transactional-messaging.service';

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
const audit = new AuditService(prismaService);
const messages = new TransactionalMessagingService(prismaService);
const catalog = new CatalogService(prismaService, audit);
const carts = new CartService(prismaService);
const orders = new OrderService(
  prismaService,
  {} as CartService,
  messages,
  audit,
);
const placementOrders = new OrderService(prismaService, carts, messages, audit);
const actor = { userId: 'integration-admin', role: 'admin' } as UserPayload;

describe('Order confirmation PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditLog",
        "CommerceMessage",
        "Customer",
        "Cart",
        "DeliveryZone",
        "Warehouse",
        "Category"
      CASCADE
    `);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('prevents two orders from reserving the same finite stock', async () => {
    const fixture = await createStockFixture('race', 2);
    const firstOrder = await createPendingOrder(
      'race-first',
      fixture.variantId,
      2,
    );
    const secondOrder = await createPendingOrder(
      'race-second',
      fixture.variantId,
      2,
    );

    const results = await Promise.allSettled([
      orders.confirmOrder(firstOrder.id, { note: 'Concurrent test' }, actor),
      orders.confirmOrder(secondOrder.id, { note: 'Concurrent test' }, actor),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toEqual(
      expect.objectContaining({ reason: expect.any(ConflictException) }),
    );
    const [stock, persistedOrders, reservations, movements] = await Promise.all(
      [
        prisma.inventoryStock.findUniqueOrThrow({
          where: { id: fixture.inventoryId },
        }),
        prisma.order.findMany({
          where: { id: { in: [firstOrder.id, secondOrder.id] } },
        }),
        prisma.inventoryReservation.findMany({
          where: { inventoryId: fixture.inventoryId },
        }),
        prisma.inventoryMovement.findMany({
          where: {
            inventoryId: fixture.inventoryId,
            type: 'RESERVE',
          },
        }),
      ],
    );
    expect(stock.reserved).toBe(2);
    expect(
      persistedOrders.filter((order) => order.status === 'CONFIRMED'),
    ).toHaveLength(1);
    expect(
      persistedOrders.filter(
        (order) => order.status === 'PENDING_CONFIRMATION',
      ),
    ).toHaveLength(1);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toEqual(
      expect.objectContaining({ quantity: 2, status: 'ACTIVE' }),
    );
    expect(movements).toHaveLength(1);
    expect(movements[0].quantityDelta).toBe(2);

    const confirmedOrder = persistedOrders.find(
      (order) => order.status === 'CONFIRMED',
    )!;
    const [statusHistory, fulfillmentHistory, audits, outbox] =
      await Promise.all([
        prisma.orderStatusHistory.count({
          where: { orderId: confirmedOrder.id, newStatus: 'CONFIRMED' },
        }),
        prisma.fulfillmentHistory.count({
          where: {
            orderId: confirmedOrder.id,
            newStatus: 'READY_FOR_FULFILLMENT',
          },
        }),
        prisma.auditLog.count({
          where: {
            action: 'ORDER_CONFIRMED',
            entityId: confirmedOrder.id,
          },
        }),
        prisma.commerceMessage.count({
          where: {
            eventType: 'ORDER_CONFIRMED',
            referenceId: confirmedOrder.id,
          },
        }),
      ]);
    expect({ statusHistory, fulfillmentHistory, audits, outbox }).toEqual({
      statusHistory: 1,
      fulfillmentHistory: 1,
      audits: 1,
      outbox: 1,
    });
  });

  it('rolls back every side effect when stock is insufficient', async () => {
    const fixture = await createStockFixture('insufficient', 1);
    const order = await createPendingOrder(
      'insufficient',
      fixture.variantId,
      2,
    );

    await expect(
      orders.confirmOrder(order.id, { note: 'Must roll back' }, actor),
    ).rejects.toThrow('Insufficient stock');

    const [
      persistedOrder,
      stock,
      reservations,
      movements,
      histories,
      audits,
      outbox,
    ] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      prisma.inventoryStock.findUniqueOrThrow({
        where: { id: fixture.inventoryId },
      }),
      prisma.inventoryReservation.count({
        where: { orderItem: { orderId: order.id } },
      }),
      prisma.inventoryMovement.count({
        where: { referenceType: 'Order', referenceId: order.id },
      }),
      prisma.orderStatusHistory.count({
        where: { orderId: order.id, newStatus: 'CONFIRMED' },
      }),
      prisma.auditLog.count({
        where: { action: 'ORDER_CONFIRMED', entityId: order.id },
      }),
      prisma.commerceMessage.count({
        where: { eventType: 'ORDER_CONFIRMED', referenceId: order.id },
      }),
    ]);
    expect(persistedOrder).toEqual(
      expect.objectContaining({
        status: 'PENDING_CONFIRMATION',
        fulfillmentStatus: 'UNFULFILLED',
        codVerification: 'REQUIRED',
        confirmedAt: null,
      }),
    );
    expect(stock.reserved).toBe(0);
    expect({ reservations, movements, histories, audits, outbox }).toEqual({
      reservations: 0,
      movements: 0,
      histories: 0,
      audits: 0,
      outbox: 0,
    });
  });

  it('releases a confirmed reservation with one inverse movement on cancellation', async () => {
    const fixture = await createStockFixture('cancellation', 3);
    const order = await createPendingOrder(
      'cancellation',
      fixture.variantId,
      2,
    );
    await orders.confirmOrder(order.id, { note: 'Ready to reserve' }, actor);

    const cancelled = await orders.cancelOrder(
      order.id,
      { reason: 'Customer requested cancellation' },
      actor,
    );

    expect(cancelled).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        cancellationReason: 'Customer requested cancellation',
      }),
    );
    const [stock, reservation, movements, histories, audits, outbox] =
      await Promise.all([
        prisma.inventoryStock.findUniqueOrThrow({
          where: { id: fixture.inventoryId },
        }),
        prisma.inventoryReservation.findFirstOrThrow({
          where: { orderItem: { orderId: order.id } },
        }),
        prisma.inventoryMovement.findMany({
          where: { referenceType: 'Order', referenceId: order.id },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.orderStatusHistory.count({
          where: { orderId: order.id, newStatus: 'CANCELLED' },
        }),
        prisma.auditLog.count({
          where: { action: 'ORDER_CANCELLED', entityId: order.id },
        }),
        prisma.commerceMessage.count({
          where: { eventType: 'ORDER_CANCELLED', referenceId: order.id },
        }),
      ]);
    expect(stock).toEqual(expect.objectContaining({ onHand: 3, reserved: 0 }));
    expect(reservation).toEqual(
      expect.objectContaining({
        status: 'RELEASED',
        quantity: 2,
        releasedAt: expect.any(Date),
      }),
    );
    expect(
      movements.map((movement) => ({
        type: movement.type,
        quantityDelta: movement.quantityDelta,
      })),
    ).toEqual([
      { type: 'RESERVE', quantityDelta: 2 },
      { type: 'RELEASE', quantityDelta: -2 },
    ]);
    expect({ histories, audits, outbox }).toEqual({
      histories: 1,
      audits: 1,
      outbox: 1,
    });
  });

  it('prevents stale concurrent adjustments beside an active reservation', async () => {
    const fixture = await createStockFixture('adjustment', 4, 'MAIN');
    const order = await createPendingOrder('adjustment', fixture.variantId, 2);
    await orders.confirmOrder(
      order.id,
      { note: 'Reserve before count' },
      actor,
    );

    const results = await Promise.allSettled([
      catalog.adjustInventory(
        fixture.variantId,
        {
          quantityDelta: -2,
          adjustmentReason: 'STOCK_COUNT_CORRECTION',
          reason: 'Concurrent cycle count A',
        },
        actor,
      ),
      catalog.adjustInventory(
        fixture.variantId,
        {
          quantityDelta: -2,
          adjustmentReason: 'STOCK_COUNT_CORRECTION',
          reason: 'Concurrent cycle count B',
        },
        actor,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toEqual(
      expect.objectContaining({ reason: expect.any(ConflictException) }),
    );
    const [stock, reservations, adjustments, audits] = await Promise.all([
      prisma.inventoryStock.findUniqueOrThrow({
        where: { id: fixture.inventoryId },
      }),
      prisma.inventoryReservation.findMany({
        where: { inventoryId: fixture.inventoryId, status: 'ACTIVE' },
      }),
      prisma.inventoryMovement.findMany({
        where: {
          inventoryId: fixture.inventoryId,
          type: 'MANUAL_ADJUSTMENT',
        },
      }),
      prisma.auditLog.count({
        where: {
          action: 'INVENTORY_ADJUSTED',
          entityId: fixture.variantId,
        },
      }),
    ]);
    expect(stock).toEqual(
      expect.objectContaining({ onHand: 2, reserved: 2, damaged: 0 }),
    );
    expect(reservations).toHaveLength(1);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].quantityDelta).toBe(-2);
    expect(audits).toBe(1);
    await prisma.warehouse.update({
      where: { id: stock.warehouseId },
      data: { code: 'ADJUSTMENT-COMPLETE' },
    });
  });

  it('converges safely when cancellation races a stock adjustment', async () => {
    const fixture = await createStockFixture('cross-command', 2, 'MAIN');
    const order = await createPendingOrder(
      'cross-command',
      fixture.variantId,
      2,
    );
    await orders.confirmOrder(
      order.id,
      { note: 'Reserve before cross-command race' },
      actor,
    );

    const [cancellationResult, adjustmentResult] = await Promise.allSettled([
      orders.cancelOrder(
        order.id,
        { reason: 'Cross-command cancellation' },
        actor,
      ),
      catalog.adjustInventory(
        fixture.variantId,
        {
          quantityDelta: -2,
          adjustmentReason: 'STOCK_COUNT_CORRECTION',
          reason: 'Cross-command cycle count',
        },
        actor,
      ),
    ]);

    expect(cancellationResult.status).toBe('fulfilled');
    const adjustmentCommitted = adjustmentResult.status === 'fulfilled';
    if (adjustmentResult.status === 'rejected') {
      expect(adjustmentResult.reason).toBeInstanceOf(ConflictException);
    }
    const [
      persistedOrder,
      stock,
      reservation,
      movements,
      cancellationAudits,
      adjustmentAudits,
      outbox,
    ] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      prisma.inventoryStock.findUniqueOrThrow({
        where: { id: fixture.inventoryId },
      }),
      prisma.inventoryReservation.findFirstOrThrow({
        where: { orderItem: { orderId: order.id } },
      }),
      prisma.inventoryMovement.findMany({
        where: { inventoryId: fixture.inventoryId },
      }),
      prisma.auditLog.count({
        where: { action: 'ORDER_CANCELLED', entityId: order.id },
      }),
      prisma.auditLog.count({
        where: {
          action: 'INVENTORY_ADJUSTED',
          entityId: fixture.variantId,
        },
      }),
      prisma.commerceMessage.count({
        where: { eventType: 'ORDER_CANCELLED', referenceId: order.id },
      }),
    ]);
    expect(persistedOrder).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
      }),
    );
    expect(stock).toEqual(
      expect.objectContaining({
        onHand: adjustmentCommitted ? 0 : 2,
        reserved: 0,
        damaged: 0,
      }),
    );
    expect(reservation).toEqual(
      expect.objectContaining({
        status: 'RELEASED',
        quantity: 2,
        releasedAt: expect.any(Date),
      }),
    );
    expect(movements.filter((movement) => movement.type === 'RESERVE')).toEqual(
      [expect.objectContaining({ quantityDelta: 2 })],
    );
    expect(movements.filter((movement) => movement.type === 'RELEASE')).toEqual(
      [expect.objectContaining({ quantityDelta: -2 })],
    );
    expect(
      movements.filter((movement) => movement.type === 'MANUAL_ADJUSTMENT'),
    ).toHaveLength(adjustmentCommitted ? 1 : 0);
    expect({ cancellationAudits, adjustmentAudits, outbox }).toEqual({
      cancellationAudits: 1,
      adjustmentAudits: adjustmentCommitted ? 1 : 0,
      outbox: 1,
    });
  });

  it('deduplicates concurrent COD placement and all snapshot side effects', async () => {
    const fixture = await createPlacementFixture('placement');
    const idempotencyKey = 'integration-cod-placement-key-0001';

    const [first, second] = await Promise.all([
      placementOrders.placeCodOrder(fixture.cartToken, idempotencyKey),
      placementOrders.placeCodOrder(fixture.cartToken, idempotencyKey),
    ]);

    expect(first.id).toBe(second.id);
    const [
      persistedOrders,
      cart,
      customers,
      addresses,
      items,
      histories,
      audits,
      outbox,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { idempotencyKeyHash: hash(idempotencyKey) },
        include: { address: true, items: true },
      }),
      prisma.cart.findUniqueOrThrow({ where: { id: fixture.cartId } }),
      prisma.customer.findMany({
        where: { phoneNormalized: fixture.phoneNormalized },
      }),
      prisma.customerAddress.findMany({
        where: { phoneNormalized: fixture.phoneNormalized },
      }),
      prisma.orderItem.findMany({ where: { orderId: first.id } }),
      prisma.orderStatusHistory.findMany({ where: { orderId: first.id } }),
      prisma.auditLog.findMany({
        where: { action: 'ORDER_PLACED', entityId: first.id },
      }),
      prisma.commerceMessage.findMany({
        where: { eventType: 'ORDER_PLACED', referenceId: first.id },
      }),
    ]);
    expect(persistedOrders).toHaveLength(1);
    expect(persistedOrders[0]).toEqual(
      expect.objectContaining({
        status: 'PENDING_CONFIRMATION',
        paymentMethod: 'COD',
        subtotal: 20000,
        discountTotal: 1000,
        deliveryFee: 6000,
        total: 25000,
        source: 'integration',
        medium: 'database-test',
      }),
    );
    expect(persistedOrders[0].address).toEqual(
      expect.objectContaining({
        recipientName: 'Placement Customer',
        district: 'Dhaka',
        area: 'Dhanmondi',
      }),
    );
    expect(cart.status).toBe('CONVERTED');
    expect(customers).toHaveLength(1);
    expect(addresses).toHaveLength(1);
    expect(items).toEqual([
      expect.objectContaining({
        productIdSnapshot: fixture.productId,
        productName: 'Placement Product',
        variantName: 'Default',
        sku: fixture.sku,
        imageUrl: fixture.imageUrl,
        unitPrice: 10000,
        weightGrams: 650,
        quantity: 2,
        lineTotal: 20000,
      }),
    ]);
    expect(histories).toEqual([
      expect.objectContaining({
        oldStatus: null,
        newStatus: 'PENDING_CONFIRMATION',
        source: 'CUSTOMER',
      }),
    ]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual(
      expect.objectContaining({ source: 'SYSTEM', entityId: first.id }),
    );
    expect(outbox).toHaveLength(1);

    const replay = await placementOrders.placeCodOrder(
      fixture.cartToken,
      idempotencyKey,
    );
    expect(replay.id).toBe(first.id);
    await expect(
      Promise.all([
        prisma.order.count({
          where: { idempotencyKeyHash: hash(idempotencyKey) },
        }),
        prisma.auditLog.count({
          where: { action: 'ORDER_PLACED', entityId: first.id },
        }),
        prisma.commerceMessage.count({
          where: { eventType: 'ORDER_PLACED', referenceId: first.id },
        }),
      ]),
    ).resolves.toEqual([1, 1, 1]);
  });

  it('deduplicates auto-confirm placement and immediate reservation effects', async () => {
    const fixture = await createPlacementFixture('auto-confirm', {
      policyMode: 'NEVER',
      stockOnHand: 2,
      quantity: 2,
    });
    const idempotencyKey = 'integration-auto-confirm-placement-key-0001';

    const [first, second] = await Promise.all([
      placementOrders.placeCodOrder(fixture.cartToken, idempotencyKey),
      placementOrders.placeCodOrder(fixture.cartToken, idempotencyKey),
    ]);

    expect(first.id).toBe(second.id);
    const [
      order,
      stock,
      reservations,
      movements,
      statusHistory,
      fulfillmentHistory,
      audits,
      outbox,
    ] = await Promise.all([
      prisma.order.findUniqueOrThrow({
        where: { id: first.id },
      }),
      prisma.inventoryStock.findUniqueOrThrow({
        where: { id: fixture.inventoryId },
      }),
      prisma.inventoryReservation.findMany({
        where: { orderItem: { orderId: first.id } },
      }),
      prisma.inventoryMovement.findMany({
        where: { referenceType: 'Order', referenceId: first.id },
      }),
      prisma.orderStatusHistory.findMany({ where: { orderId: first.id } }),
      prisma.fulfillmentHistory.findMany({ where: { orderId: first.id } }),
      prisma.auditLog.findMany({
        where: { action: 'ORDER_PLACED', entityId: first.id },
      }),
      prisma.commerceMessage.findMany({
        where: { referenceType: 'Order', referenceId: first.id },
        orderBy: { eventType: 'asc' },
      }),
    ]);
    expect(order).toEqual(
      expect.objectContaining({
        status: 'CONFIRMED',
        fulfillmentStatus: 'READY_FOR_FULFILLMENT',
        codVerification: 'NOT_REQUIRED',
        confirmedAt: expect.any(Date),
      }),
    );
    expect(stock).toEqual(expect.objectContaining({ onHand: 2, reserved: 2 }));
    expect(reservations).toEqual([
      expect.objectContaining({ quantity: 2, status: 'ACTIVE' }),
    ]);
    expect(movements).toEqual([
      expect.objectContaining({ type: 'RESERVE', quantityDelta: 2 }),
    ]);
    expect(statusHistory).toEqual([
      expect.objectContaining({
        oldStatus: null,
        newStatus: 'CONFIRMED',
        source: 'CUSTOMER',
      }),
    ]);
    expect(fulfillmentHistory).toEqual([
      expect.objectContaining({
        oldStatus: 'UNFULFILLED',
        newStatus: 'READY_FOR_FULFILLMENT',
        source: 'SYSTEM',
      }),
    ]);
    expect(audits).toHaveLength(1);
    expect(outbox.map((message) => message.eventType)).toEqual([
      'ORDER_CONFIRMED',
      'ORDER_PLACED',
    ]);

    const replay = await placementOrders.placeCodOrder(
      fixture.cartToken,
      idempotencyKey,
    );
    expect(replay.id).toBe(first.id);
    await expect(
      Promise.all([
        prisma.inventoryReservation.count({
          where: { orderItem: { orderId: first.id } },
        }),
        prisma.inventoryMovement.count({
          where: { referenceType: 'Order', referenceId: first.id },
        }),
        prisma.auditLog.count({
          where: { action: 'ORDER_PLACED', entityId: first.id },
        }),
        prisma.commerceMessage.count({
          where: { referenceType: 'Order', referenceId: first.id },
        }),
      ]),
    ).resolves.toEqual([1, 1, 1, 2]);
  });

  it('leaves an insufficient-stock auto-confirm cart untouched', async () => {
    const fixture = await createPlacementFixture('auto-insufficient', {
      policyMode: 'NEVER',
      stockOnHand: 1,
      quantity: 2,
    });
    const idempotencyKey = 'integration-auto-insufficient-key-0001';

    await expect(
      placementOrders.placeCodOrder(fixture.cartToken, idempotencyKey),
    ).rejects.toBeInstanceOf(ConflictException);

    const [ordersCount, cart, stock, customers, movements, audits, outbox] =
      await Promise.all([
        prisma.order.count({
          where: { idempotencyKeyHash: hash(idempotencyKey) },
        }),
        prisma.cart.findUniqueOrThrow({ where: { id: fixture.cartId } }),
        prisma.inventoryStock.findUniqueOrThrow({
          where: { id: fixture.inventoryId },
        }),
        prisma.customer.count({
          where: { phoneNormalized: fixture.phoneNormalized },
        }),
        prisma.inventoryMovement.count({
          where: { inventoryId: fixture.inventoryId },
        }),
        prisma.auditLog.count({
          where: {
            action: 'ORDER_PLACED',
            metadata: { path: ['cartId'], equals: fixture.cartId },
          },
        }),
        prisma.commerceMessage.count({
          where: { recipient: fixture.phoneNormalized },
        }),
      ]);
    expect(ordersCount).toBe(0);
    expect(cart.status).toBe('ACTIVE');
    expect(stock).toEqual(expect.objectContaining({ onHand: 1, reserved: 0 }));
    expect(customers).toBe(0);
    expect(movements).toBe(0);
    expect(outbox).toBe(0);
    expect(audits).toBe(0);
  });
});

async function createStockFixture(
  suffix: string,
  onHand: number,
  warehouseCode = `WH-${suffix.toUpperCase()}`,
) {
  const category = await prisma.category.create({
    data: { name: `Category ${suffix}`, slug: `category-${suffix}` },
  });
  const product = await prisma.product.create({
    data: {
      name: `Product ${suffix}`,
      slug: `product-${suffix}`,
      description: 'Order confirmation integration fixture',
      categoryId: category.id,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      name: 'Default',
      sku: `ORDER-${suffix.toUpperCase()}`,
      price: 10000,
      productId: product.id,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: warehouseCode, name: `Warehouse ${suffix}` },
  });
  const inventory = await prisma.inventoryStock.create({
    data: {
      warehouseId: warehouse.id,
      variantId: variant.id,
      onHand,
    },
  });
  return { variantId: variant.id, inventoryId: inventory.id };
}

async function createPendingOrder(
  suffix: string,
  variantId: string,
  quantity: number,
) {
  const customer = await prisma.customer.create({
    data: {
      name: `Customer ${suffix}`,
      phoneOriginal: '01700000000',
      phoneNormalized: `+88017${suffix.length.toString().padStart(8, '0')}`,
    },
  });
  const cart = await prisma.cart.create({
    data: {
      tokenHash: hash(`cart-${suffix}`),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const deliveryZone = await prisma.deliveryZone.create({
    data: { name: `Zone ${suffix}`, deliveryFee: 6000 },
  });
  const checkoutDraft = await prisma.checkoutDraft.create({
    data: {
      cartId: cart.id,
      deliveryZoneId: deliveryZone.id,
      name: customer.name,
      phoneOriginal: customer.phoneOriginal,
      phoneNormalized: customer.phoneNormalized,
      district: 'Dhaka',
      area: 'Dhanmondi',
      detailedAddress: 'Integration test address',
      termsAccepted: true,
      subtotal: 10000 * quantity,
      deliveryFee: 6000,
      total: 10000 * quantity + 6000,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return prisma.order.create({
    data: {
      reference: `FER-INTEGRATION-${suffix.toUpperCase()}`,
      idempotencyKeyHash: hash(`order-${suffix}`),
      subtotal: 10000 * quantity,
      deliveryFee: 6000,
      total: 10000 * quantity + 6000,
      customerId: customer.id,
      checkoutDraftId: checkoutDraft.id,
      address: {
        create: {
          recipientName: customer.name,
          phoneOriginal: customer.phoneOriginal,
          phoneNormalized: customer.phoneNormalized,
          district: 'Dhaka',
          area: 'Dhanmondi',
          detailedAddress: 'Integration test address',
        },
      },
      items: {
        create: {
          productIdSnapshot: `product-${suffix}`,
          productName: `Product ${suffix}`,
          variantName: 'Default',
          sku: `SNAPSHOT-${suffix.toUpperCase()}`,
          unitPrice: 10000,
          weightGrams: 500,
          quantity,
          lineTotal: 10000 * quantity,
          variantId,
        },
      },
    },
  });
}

async function createPlacementFixture(
  suffix: string,
  options: {
    policyMode?: 'ALWAYS' | 'ABOVE_AMOUNT' | 'NEVER';
    stockOnHand?: number;
    quantity?: number;
  } = {},
) {
  const policyMode = options.policyMode ?? 'ALWAYS';
  const stockOnHand = options.stockOnHand ?? 10;
  const quantity = options.quantity ?? 2;
  const subtotal = 10000 * quantity;
  const discountTotal = 1000;
  const deliveryFee = 6000;
  const total = subtotal - discountTotal + deliveryFee;
  const sku = `PLACEMENT-${suffix.toUpperCase()}-SKU`;
  const imageUrl = `https://cdn.ferio.test/${suffix}.jpg`;
  const category = await prisma.category.create({
    data: { name: 'Placement Category', slug: `placement-category-${suffix}` },
  });
  const product = await prisma.product.create({
    data: {
      name: 'Placement Product',
      slug: `placement-product-${suffix}`,
      description: 'Concurrent placement integration fixture',
      status: 'ACTIVE',
      publishedAt: new Date(Date.now() - 60_000),
      categoryId: category.id,
      media: {
        create: {
          url: imageUrl,
          type: 'IMAGE',
          sortOrder: 0,
        },
      },
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      name: 'Default',
      sku,
      price: 10000,
      weightGrams: 650,
      productId: product.id,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      code: `PLACEMENT-${suffix.toUpperCase()}`,
      name: `Placement Warehouse ${suffix}`,
    },
  });
  const inventory = await prisma.inventoryStock.create({
    data: {
      warehouseId: warehouse.id,
      variantId: variant.id,
      onHand: stockOnHand,
    },
  });
  const cartToken = `placement-cart-token-${suffix}`;
  const cart = await prisma.cart.create({
    data: {
      tokenHash: hash(cartToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      items: {
        create: {
          variantId: variant.id,
          quantity,
          addedUnitPrice: 10000,
        },
      },
    },
  });
  const deliveryZone = await prisma.deliveryZone.create({
    data: { name: `Placement Zone ${suffix}`, deliveryFee },
  });
  const phoneNormalized = `+88017000${suffix.length.toString().padStart(5, '0')}`;
  await prisma.checkoutDraft.create({
    data: {
      cartId: cart.id,
      deliveryZoneId: deliveryZone.id,
      name: 'Placement Customer',
      phoneOriginal: '01712345678',
      phoneNormalized,
      email: 'placement@ferio.test',
      district: 'Dhaka',
      area: 'Dhanmondi',
      detailedAddress: 'House 1, Road 2',
      landmark: 'Integration landmark',
      termsAccepted: true,
      source: 'integration',
      medium: 'database-test',
      subtotal,
      discountTotal,
      deliveryFee,
      total,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await prisma.codVerificationPolicy.upsert({
    where: { id: 'default' },
    update: { mode: policyMode, amountThreshold: null },
    create: { id: 'default', mode: policyMode },
  });
  return {
    cartId: cart.id,
    cartToken,
    phoneNormalized,
    productId: product.id,
    inventoryId: inventory.id,
    sku,
    imageUrl,
  };
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
