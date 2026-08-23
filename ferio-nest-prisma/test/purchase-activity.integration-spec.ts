import type { PrismaService } from '@app/database';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import { Pool } from 'pg';
import { PurchaseActivityService } from '../src/features/purchase-activity/purchase-activity.service';

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
const activity = new PurchaseActivityService(
  prisma as unknown as PrismaService,
);
let zoneId: string;
let customerId: string;

describe('Purchase activity PostgreSQL integration', () => {
  let leadVariant: ProductFixture;
  let accessoryVariant: ProductFixture;
  let excludedVariant: ProductFixture;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "CommerceSettings",
        "Customer",
        "Cart",
        "DeliveryZone",
        "Category"
      CASCADE
    `);
    const zone = await prisma.deliveryZone.create({
      data: { name: 'Dhaka integration zone', deliveryFee: 6000 },
    });
    zoneId = zone.id;
    const customer = await prisma.customer.create({
      data: {
        name: 'Rahim Uddin',
        phoneOriginal: '01712345678',
        phoneNormalized: '+8801712345678',
        email: 'rahim.integration@ferio.test',
      },
    });
    customerId = customer.id;
    leadVariant = await createProduct('Sunpeed Cycle', 'cycle');
    accessoryVariant = await createProduct('Cycle Light', 'light');
    excludedVariant = await createProduct('Private Gift', 'gift');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('returns no public records while each surface is disabled', async () => {
    await setSettings({
      purchaseActivityEnabled: false,
      purchaseHistoryEnabled: false,
    });
    await createOrder('disabled', {
      status: 'DELIVERED',
      consent: true,
      items: [{ fixture: leadVariant, quantity: 1 }],
    });

    await expect(
      activity.getPublic({ surface: 'toast', page: 1, limit: 10 }),
    ).resolves.toEqual(expect.objectContaining({ items: [], total: 0 }));
    await expect(
      activity.getPublic({ surface: 'history', page: 1, limit: 10 }),
    ).resolves.toEqual(expect.objectContaining({ items: [], total: 0 }));
  });

  it('includes only consented terminal orders and aggregates visible quantities', async () => {
    await prisma.order.deleteMany();
    await setSettings({
      purchaseActivityEnabled: true,
      purchaseHistoryEnabled: true,
      purchaseActivityShowArea: true,
      purchaseActivityShowDistrict: true,
      purchaseActivityExcludedProductIds: [excludedVariant.productId],
    });
    const eligible = await createOrder('eligible', {
      status: 'DELIVERED',
      consent: true,
      recipientName: 'শাওন রহমান',
      items: [
        { fixture: leadVariant, quantity: 1 },
        { fixture: excludedVariant, quantity: 4 },
        { fixture: accessoryVariant, quantity: 2 },
      ],
    });
    await createOrder('no-consent', {
      status: 'DELIVERED',
      consent: false,
      items: [{ fixture: leadVariant, quantity: 1 }],
    });
    await createOrder('not-terminal', {
      status: 'CONFIRMED',
      consent: true,
      items: [{ fixture: leadVariant, quantity: 1 }],
    });
    await createOrder('too-old', {
      status: 'COMPLETED',
      consent: true,
      createdAt: new Date(Date.now() - 31 * 86_400_000),
      items: [{ fixture: leadVariant, quantity: 1 }],
    });

    const result = await activity.getPublic({
      surface: 'toast',
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: eligible.id,
        customerName: 'শ***',
        productName: 'Sunpeed Cycle',
        additionalItemCount: 2,
        location: 'Rampura Bazar',
        verifiedPurchase: true,
      }),
    ]);
  });

  it('paginates by order and falls back from area to district visibility', async () => {
    await setSettings({
      purchaseActivityEnabled: true,
      purchaseHistoryEnabled: true,
      purchaseActivityShowArea: false,
      purchaseActivityShowDistrict: true,
      purchaseActivityExcludedProductIds: [],
    });
    await createOrder('pagination-second', {
      status: 'COMPLETED',
      consent: true,
      createdAt: new Date(Date.now() + 1000),
      items: [{ fixture: accessoryVariant, quantity: 1 }],
    });
    const newest = await createOrder('pagination-third', {
      status: 'DELIVERED',
      consent: true,
      createdAt: new Date(Date.now() + 2000),
      items: [{ fixture: leadVariant, quantity: 1 }],
    });

    const firstPage = await activity.getPublic({
      surface: 'history',
      page: 1,
      limit: 2,
    });
    const secondPage = await activity.getPublic({
      surface: 'history',
      page: 2,
      limit: 2,
    });

    expect(firstPage).toEqual(
      expect.objectContaining({ page: 1, limit: 2, total: 3, totalPages: 2 }),
    );
    expect(firstPage.items[0]).toEqual(
      expect.objectContaining({ id: newest.id, location: 'Dhaka' }),
    );
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(1);
  });
});

type ProductFixture = {
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
};

async function createProduct(name: string, suffix: string): Promise<ProductFixture> {
  const category = await prisma.category.create({
    data: {
      name: `Activity ${suffix}`,
      slug: `activity-${suffix}`,
    },
  });
  const product = await prisma.product.create({
    data: {
      name,
      slug: `activity-${suffix}-product`,
      description: 'Purchase activity integration fixture',
      status: 'ACTIVE',
      categoryId: category.id,
    },
  });
  const sku = `ACTIVITY-${suffix.toUpperCase()}`;
  const variant = await prisma.productVariant.create({
    data: {
      name: 'Default',
      sku,
      price: 10000,
      weightGrams: 500,
      productId: product.id,
    },
  });
  return { productId: product.id, variantId: variant.id, productName: name, sku };
}

async function createOrder(
  suffix: string,
  input: {
    status: 'CONFIRMED' | 'DELIVERED' | 'COMPLETED';
    consent: boolean;
    recipientName?: string;
    createdAt?: Date;
    items: Array<{ fixture: ProductFixture; quantity: number }>;
  },
) {
  const createdAt = input.createdAt ?? new Date();
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * 10000,
    0,
  );
  const cart = await prisma.cart.create({
    data: {
      tokenHash: hash(`activity-cart-${suffix}`),
      status: 'CONVERTED',
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const draft = await prisma.checkoutDraft.create({
    data: {
      cartId: cart.id,
      deliveryZoneId: zoneId,
      name: input.recipientName ?? 'Rahim Uddin',
      phoneOriginal: '01712345678',
      phoneNormalized: '+8801712345678',
      district: 'Dhaka',
      area: 'Rampura Bazar',
      detailedAddress: 'Integration address hidden from public output',
      purchaseActivityConsent: input.consent,
      purchaseActivityConsentAt: input.consent ? createdAt : null,
      termsAccepted: true,
      subtotal,
      deliveryFee: 6000,
      total: subtotal + 6000,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt,
    },
  });
  return prisma.order.create({
    data: {
      reference: `ACT-${suffix}`,
      idempotencyKeyHash: hash(`activity-order-${suffix}`),
      status: input.status,
      paymentStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      shipmentStatus: 'DELIVERED',
      codVerification: 'NOT_REQUIRED',
      subtotal,
      deliveryFee: 6000,
      total: subtotal + 6000,
      customerId,
      checkoutDraftId: draft.id,
      purchaseActivityConsent: input.consent,
      createdAt,
      address: {
        create: {
          recipientName: input.recipientName ?? 'Rahim Uddin',
          phoneOriginal: '01712345678',
          phoneNormalized: '+8801712345678',
          district: 'Dhaka',
          area: 'Rampura Bazar',
          detailedAddress: 'Integration address hidden from public output',
          createdAt,
        },
      },
      items: {
        create: input.items.map((item, index) => ({
          productIdSnapshot: item.fixture.productId,
          productName: item.fixture.productName,
          variantName: 'Default',
          sku: item.fixture.sku,
          unitPrice: 10000,
          weightGrams: 500,
          quantity: item.quantity,
          lineTotal: item.quantity * 10000,
          variantId: item.fixture.variantId,
          imageUrl: `https://cdn.ferio.test/${item.fixture.productId}.jpg`,
          createdAt: new Date(createdAt.getTime() + index),
        })),
      },
    },
  });
}

function setSettings(
  data: Partial<{
    purchaseActivityEnabled: boolean;
    purchaseHistoryEnabled: boolean;
    purchaseActivityShowDistrict: boolean;
    purchaseActivityShowArea: boolean;
    purchaseActivityExcludedProductIds: string[];
  }>,
) {
  return prisma.commerceSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', storeName: 'Ferio', ...data },
  });
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
