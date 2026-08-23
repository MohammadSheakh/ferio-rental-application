import type { UserPayload } from '@app/common';
import type { PrismaService } from '@app/database';
import { createHash } from 'crypto';
import { readdirSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AuditService } from '../src/features/audit/audit.service';
import { ReconciliationService } from '../src/features/reconciliation/reconciliation.service';

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
const audit = new AuditService(prisma as unknown as PrismaService);
const reconciliation = new ReconciliationService(
  prisma as unknown as PrismaService,
  audit,
);
const actor = { userId: 'integration-admin', role: 'admin' } as UserPayload;

describe('Reconciliation PostgreSQL integration', () => {
  let inventoryId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditLog",
        "ReconciliationFinding",
        "ReconciliationRun",
        "InventoryMovement",
        "InventoryReservation",
        "InventoryStock",
        "Warehouse",
        "ProductMedia",
        "ProductVariant",
        "Product",
        "Category"
      CASCADE
    `);
    const category = await prisma.category.create({
      data: { name: 'Integration Category', slug: 'integration-category' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Integration Product',
        slug: 'integration-product',
        description: 'Database integration fixture',
        categoryId: category.id,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        name: 'Default',
        sku: 'INTEGRATION-SKU-1',
        price: 10000,
        productId: product.id,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: 'INTEGRATION', name: 'Integration Warehouse' },
    });
    const inventory = await prisma.inventoryStock.create({
      data: {
        warehouseId: warehouse.id,
        variantId: variant.id,
        onHand: 2,
        reserved: 2,
        damaged: 1,
      },
    });
    inventoryId = inventory.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('has the complete migration chain applied', async () => {
    const expectedMigrationCount = readdirSync(
      join(__dirname, '../prisma/migrations'),
      { withFileTypes: true },
    ).filter((entry) => entry.isDirectory()).length;
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(Number(rows[0].count)).toBe(expectedMigrationCount);
  });

  it('persists a seeded stock inconsistency and audit evidence', async () => {
    const run = await reconciliation.run(
      'integration-seeded-inconsistency-0001',
      { overdueHours: 168 },
      actor,
    );

    expect(run.status).toBe('COMPLETED');
    expect(run.detectedCount).toBe(1);
    expect(run.openedCount).toBe(1);
    const finding = await prisma.reconciliationFinding.findUnique({
      where: {
        fingerprint: createFindingFingerprint(
          'INVALID_STOCK_BALANCE',
          'InventoryStock',
          inventoryId,
        ),
      },
    });
    expect(finding).toEqual(
      expect.objectContaining({
        type: 'INVALID_STOCK_BALANCE',
        status: 'OPEN',
        entityId: inventoryId,
      }),
    );
    await expect(
      prisma.auditLog.count({
        where: {
          action: 'RECONCILIATION_SCAN_COMPLETED',
          entityId: run.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it('deduplicates concurrent scans with the same idempotency key', async () => {
    const idempotencyKey = 'integration-concurrent-scan-key-0001';
    await Promise.all([
      reconciliation.run(idempotencyKey, { overdueHours: 168 }, actor),
      reconciliation.run(idempotencyKey, { overdueHours: 168 }, actor),
    ]);

    const runs = await prisma.reconciliationRun.findMany({
      where: { idempotencyKeyHash: hash(idempotencyKey) },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual(
      expect.objectContaining({ status: 'COMPLETED', attemptCount: 1 }),
    );
  });

  it('auto-resolves the finding after the stock balance is corrected', async () => {
    await prisma.inventoryStock.update({
      where: { id: inventoryId },
      data: { reserved: 1 },
    });
    const run = await reconciliation.run(
      'integration-auto-resolution-key-0001',
      { overdueHours: 168 },
      actor,
    );

    expect(run.autoResolvedCount).toBe(1);
    await expect(
      prisma.reconciliationFinding.findFirstOrThrow({
        where: { entityId: inventoryId, type: 'INVALID_STOCK_BALANCE' },
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'RESOLVED' }));
  });
});

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function createFindingFingerprint(
  type: string,
  entityType: string,
  entityId: string,
) {
  return hash(`${type}:${entityType}:${entityId}`);
}
