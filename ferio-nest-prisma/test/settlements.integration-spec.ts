import { ConflictException } from '@nestjs/common';
import type { UserPayload } from '@app/common';
import type { PrismaService } from '@app/database';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AuditService } from '../src/features/audit/audit.service';
import { SettlementImportsService } from '../src/features/settlements/settlement-imports.service';
import { SettlementReportParserService } from '../src/features/settlements/settlement-report-parser.service';
import { SettlementsService } from '../src/features/settlements/settlements.service';

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
const settlements = new SettlementsService(prismaService, audit);
const reportParser = new SettlementReportParserService();
const settlementImports = new SettlementImportsService(
  prismaService,
  settlements,
  audit,
  reportParser,
);
const actor = {
  userId: 'settlement-integration-admin',
  role: 'admin',
} as UserPayload;

describe('Courier settlement PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditLog",
        "Customer",
        "Cart",
        "DeliveryZone",
        "ShipmentProvider"
      CASCADE
    `);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('deduplicates concurrent settlement recording and every financial effect', async () => {
    const fixture = await createSettlementFixture('duplicate', [150000]);
    const dto = settlementDto(
      'duplicate',
      fixture.shipmentIds,
      [150000],
      145000,
    );

    const [first, second] = await Promise.all([
      settlements.create(
        'settlement-integration-duplicate-key-0001',
        dto,
        actor,
      ),
      settlements.create(
        'settlement-integration-duplicate-key-0001',
        dto,
        actor,
      ),
    ]);

    expect(first.id).toBe(second.id);
    expect(first).toEqual(
      expect.objectContaining({
        status: 'MATCHED',
        grossCollected: 150000,
        courierFees: 5000,
        expectedRemittance: 145000,
        remittedAmount: 145000,
        variance: 0,
      }),
    );
    const [settlementCount, itemCount, collection, order, auditCount] =
      await Promise.all([
        prisma.courierSettlement.count(),
        prisma.courierSettlementItem.count(),
        prisma.codCollection.findUniqueOrThrow({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
        prisma.order.findUniqueOrThrow({ where: { id: fixture.orderIds[0] } }),
        prisma.auditLog.count({
          where: {
            action: 'COURIER_SETTLEMENT_RECORDED',
            entityId: first.id,
          },
        }),
      ]);
    expect({ settlementCount, itemCount, auditCount }).toEqual({
      settlementCount: 1,
      itemCount: 1,
      auditCount: 1,
    });
    expect(collection).toEqual(
      expect.objectContaining({
        status: 'SETTLED',
        collectedAmount: 150000,
        collectionVariance: 0,
      }),
    );
    expect(order.paymentStatus).toBe('PAID');

    await expect(
      settlements.create(
        'settlement-integration-duplicate-key-0001',
        dto,
        actor,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: first.id }));
    await expect(
      Promise.all([
        prisma.courierSettlement.count(),
        prisma.courierSettlementItem.count(),
        prisma.auditLog.count({
          where: { action: 'COURIER_SETTLEMENT_RECORDED' },
        }),
      ]),
    ).resolves.toEqual([1, 1, 1]);
  });

  it('allows only one overlapping batch to claim a COD collection', async () => {
    const fixture = await createSettlementFixture('overlap', [100000, 80000]);
    const firstDto = settlementDto(
      'overlap-first',
      [fixture.shipmentIds[0]],
      [100000],
      95000,
    );
    const secondDto = settlementDto(
      'overlap-second',
      fixture.shipmentIds,
      [100000, 80000],
      170000,
    );

    const results = await Promise.allSettled([
      settlements.create(
        'settlement-integration-overlap-key-0001',
        firstDto,
        actor,
      ),
      settlements.create(
        'settlement-integration-overlap-key-0002',
        secondDto,
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
    const [settlementCount, sharedItemCount, auditCount, sharedCollection] =
      await Promise.all([
        prisma.courierSettlement.count({
          where: { providerSettlementReference: { startsWith: 'overlap-' } },
        }),
        prisma.courierSettlementItem.count({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
        prisma.auditLog.count({
          where: {
            action: 'COURIER_SETTLEMENT_RECORDED',
            metadata: { path: ['provider'], equals: 'STEADFAST' },
          },
        }),
        prisma.codCollection.findUniqueOrThrow({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
      ]);
    expect(settlementCount).toBe(1);
    expect(sharedItemCount).toBe(1);
    expect(auditCount).toBe(2);
    expect(sharedCollection.status).toBe('SETTLED');
  });

  it('deduplicates report replay and quarantines a reused provider row', async () => {
    const fixture = await createSettlementFixture('import-replay', [120000]);
    const dto = importDto(
      'import-replay',
      fixture.trackingNumbers,
      ['provider-row-replay-1'],
      [120000],
      115000,
    );

    const [first, second] = await Promise.all([
      settlementImports.importReport(
        'settlement-import-replay-key-0001',
        dto,
        actor,
      ),
      settlementImports.importReport(
        'settlement-import-replay-key-0001',
        dto,
        actor,
      ),
    ]);

    expect(first.id).toBe(second.id);
    expect(first).toEqual(
      expect.objectContaining({
        status: 'APPLIED',
        rowCount: 1,
        appliedCount: 1,
        exceptionCount: 0,
        settlementId: expect.any(String),
      }),
    );
    await expect(
      Promise.all([
        prisma.courierSettlementImport.count({
          where: { providerReportReference: 'import-replay-report' },
        }),
        prisma.courierSettlementImportRow.count({
          where: { providerRowReference: 'provider-row-replay-1' },
        }),
        prisma.courierSettlementItem.count({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
        prisma.auditLog.count({
          where: {
            action: 'COURIER_SETTLEMENT_REPORT_IMPORTED',
            entityId: first.id,
          },
        }),
      ]),
    ).resolves.toEqual([1, 1, 1, 1]);

    const duplicateRowImport = await settlementImports.importReport(
      'settlement-import-duplicate-row-key-0001',
      { ...dto, providerReportReference: 'import-replay-copy-report' },
      actor,
    );
    expect(duplicateRowImport).toEqual(
      expect.objectContaining({
        status: 'NEEDS_REVIEW',
        appliedCount: 0,
        exceptionCount: 1,
        settlementId: null,
      }),
    );
    expect(duplicateRowImport.rows[0]).toEqual(
      expect.objectContaining({ status: 'DUPLICATE' }),
    );
  });

  it('quarantines a mixed report without partially settling valid rows', async () => {
    const fixture = await createSettlementFixture('import-quarantine', [90000]);
    const report = await settlementImports.importReport(
      'settlement-import-quarantine-key-0001',
      importDto(
        'import-quarantine',
        [fixture.trackingNumbers[0], 'MISSING-TRACKING-001'],
        ['provider-row-quarantine-1', 'provider-row-quarantine-2'],
        [90000, 40000],
        120000,
      ),
      actor,
    );

    expect(report).toEqual(
      expect.objectContaining({
        status: 'NEEDS_REVIEW',
        rowCount: 2,
        appliedCount: 1,
        exceptionCount: 1,
        settlementId: null,
      }),
    );
    expect(report.rows.map((row) => row.status).sort()).toEqual([
      'APPLIED',
      'UNMATCHED',
    ]);
    const [collection, order, settlementCount] = await Promise.all([
      prisma.codCollection.findUniqueOrThrow({
        where: { shipmentId: fixture.shipmentIds[0] },
      }),
      prisma.order.findUniqueOrThrow({ where: { id: fixture.orderIds[0] } }),
      prisma.courierSettlement.count({
        where: { providerSettlementReference: 'import-quarantine-report' },
      }),
    ]);
    expect(collection.status).toBe('EXPECTED');
    expect(order.paymentStatus).toBe('UNPAID');
    expect(settlementCount).toBe(0);
  });

  it('converges overlapping imports to one applied report and one review queue', async () => {
    const fixture = await createSettlementFixture('import-overlap', [70000]);
    const firstDto = importDto(
      'import-overlap-first',
      fixture.trackingNumbers,
      ['provider-row-overlap-first'],
      [70000],
      65000,
    );
    const secondDto = importDto(
      'import-overlap-second',
      fixture.trackingNumbers,
      ['provider-row-overlap-second'],
      [70000],
      65000,
    );

    const results = await Promise.all([
      settlementImports.importReport(
        'settlement-import-overlap-key-0001',
        firstDto,
        actor,
      ),
      settlementImports.importReport(
        'settlement-import-overlap-key-0002',
        secondDto,
        actor,
      ),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'APPLIED',
      'NEEDS_REVIEW',
    ]);
    expect(
      results
        .flatMap((result) => result.rows)
        .map((row) => row.status)
        .sort(),
    ).toEqual(['ALREADY_SETTLED', 'APPLIED']);
    await expect(
      Promise.all([
        prisma.courierSettlement.count({
          where: {
            providerSettlementReference: { startsWith: 'import-overlap-' },
          },
        }),
        prisma.courierSettlementItem.count({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
        prisma.courierSettlementImport.count({
          where: {
            providerReportReference: { startsWith: 'import-overlap-' },
          },
        }),
      ]),
    ).resolves.toEqual([1, 1, 2]);
  });

  it('supersedes a quarantined report without changing its source rows', async () => {
    const fixture = await createSettlementFixture('correction', [90000, 60000]);
    const original = await settlementImports.importReport(
      'settlement-correction-original-key-0001',
      importDto(
        'correction-original',
        [fixture.trackingNumbers[0], 'MISSING-CORRECTION-TRACKING'],
        ['provider-row-correction-1', 'provider-row-correction-2'],
        [90000, 60000],
        140000,
      ),
      actor,
    );
    expect(original.status).toBe('NEEDS_REVIEW');

    const corrected = await settlementImports.importReport(
      'settlement-correction-applied-key-0001',
      {
        ...importDto(
          'correction-applied',
          fixture.trackingNumbers,
          ['provider-row-correction-1', 'provider-row-correction-2'],
          [90000, 60000],
          140000,
        ),
        supersedesImportId: original.id,
      },
      actor,
    );

    expect(corrected).toEqual(
      expect.objectContaining({
        status: 'APPLIED',
        supersedesImportId: original.id,
        settlementId: expect.any(String),
      }),
    );
    const [persistedOriginal, originalRows, correctedRows, settlementItems] =
      await Promise.all([
        prisma.courierSettlementImport.findUniqueOrThrow({
          where: { id: original.id },
          include: { supersededBy: true },
        }),
        prisma.courierSettlementImportRow.findMany({
          where: { importId: original.id },
          orderBy: { providerRowReference: 'asc' },
        }),
        prisma.courierSettlementImportRow.findMany({
          where: { importId: corrected.id },
          orderBy: { providerRowReference: 'asc' },
        }),
        prisma.courierSettlementItem.count({
          where: { shipmentId: { in: fixture.shipmentIds } },
        }),
      ]);
    expect(persistedOriginal).toEqual(
      expect.objectContaining({
        status: 'SUPERSEDED',
        resolvedAt: expect.any(Date),
        supersededBy: expect.objectContaining({ id: corrected.id }),
      }),
    );
    expect(originalRows.map((row) => row.status).sort()).toEqual([
      'APPLIED',
      'UNMATCHED',
    ]);
    expect(originalRows.every((row) => row.deduplicationKey === null)).toBe(
      true,
    );
    expect(correctedRows.every((row) => row.deduplicationKey !== null)).toBe(
      true,
    );
    expect(settlementItems).toBe(2);
    await expect(
      prisma.auditLog.count({
        where: {
          action: 'COURIER_SETTLEMENT_REPORT_SUPERSEDED',
          entityId: original.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it('allows only one concurrent correction to claim a review import', async () => {
    const fixture = await createSettlementFixture('correction-race', [80000]);
    const original = await settlementImports.importReport(
      'settlement-correction-race-original-key-0001',
      importDto(
        'correction-race-original',
        ['MISSING-CORRECTION-RACE'],
        ['provider-row-correction-race'],
        [80000],
        75000,
      ),
      actor,
    );
    const firstDto = {
      ...importDto(
        'correction-race-first',
        fixture.trackingNumbers,
        ['provider-row-correction-race'],
        [80000],
        75000,
      ),
      supersedesImportId: original.id,
    };
    const secondDto = {
      ...firstDto,
      providerReportReference: 'correction-race-second-report',
      bankReference: 'correction-race-second-bank',
    };

    const results = await Promise.allSettled([
      settlementImports.importReport(
        'settlement-correction-race-first-key-0001',
        firstDto,
        actor,
      ),
      settlementImports.importReport(
        'settlement-correction-race-second-key-0001',
        secondDto,
        actor,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toEqual(
      expect.objectContaining({ reason: expect.any(ConflictException) }),
    );
    await expect(
      Promise.all([
        prisma.courierSettlementImport.count({
          where: { supersedesImportId: original.id },
        }),
        prisma.courierSettlementItem.count({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
        prisma.auditLog.count({
          where: {
            action: 'COURIER_SETTLEMENT_REPORT_SUPERSEDED',
            entityId: original.id,
          },
        }),
      ]),
    ).resolves.toEqual([1, 1, 1]);
  });

  it('binds validated CSV checksums to immutable import evidence', async () => {
    const fixture = await createSettlementFixture('csv-bound', [110000]);
    const content = [
      'provider_row_reference,tracking_number,collected_amount,courier_fee,other_deduction,note',
      `csv-bound-row,${fixture.trackingNumbers[0]},1100,50,0,"CSV evidence"`,
    ].join('\n');
    const preflight = reportParser.preflight({
      provider: 'STEADFAST',
      fileName: 'steadfast-bound.csv',
      content,
    });
    const imported = await settlementImports.importReport(
      'settlement-csv-bound-key-0001',
      {
        ...importDto(
          'csv-bound',
          fixture.trackingNumbers,
          ['csv-bound-row'],
          [110000],
          105000,
        ),
        source: 'CSV',
        rows: [
          {
            providerRowReference: 'csv-bound-row',
            trackingNumber: fixture.trackingNumbers[0],
            collectedAmount: 110000,
            courierFee: 5000,
            otherDeduction: 0,
            note: 'CSV evidence',
          },
        ],
        csvEvidence: {
          fileName: 'steadfast-bound.csv',
          sourceChecksum: preflight.sourceChecksum,
          content,
        },
      },
      actor,
    );

    expect(imported).toEqual(
      expect.objectContaining({
        status: 'APPLIED',
        sourceFileName: 'steadfast-bound.csv',
        sourceFileChecksum: preflight.sourceChecksum,
        parserVersion: 'canonical-v1',
        normalizedRowsChecksum: preflight.normalizedRowsChecksum,
      }),
    );
    expect(JSON.stringify(imported.rawPayload)).not.toContain(content);
  });

  it('rejects row drift after CSV preflight without financial effects', async () => {
    const fixture = await createSettlementFixture('csv-drift', [100000]);
    const content = [
      'provider_row_reference,tracking_number,collected_amount,courier_fee,other_deduction',
      `csv-drift-row,${fixture.trackingNumbers[0]},1000,50,0`,
    ].join('\n');
    const preflight = reportParser.preflight({
      provider: 'STEADFAST',
      fileName: 'steadfast-drift.csv',
      content,
    });

    await expect(
      settlementImports.importReport(
        'settlement-csv-drift-key-0001',
        {
          ...importDto(
            'csv-drift',
            fixture.trackingNumbers,
            ['csv-drift-row'],
            [99000],
            94000,
          ),
          source: 'CSV',
          csvEvidence: {
            fileName: 'steadfast-drift.csv',
            sourceChecksum: preflight.sourceChecksum,
            content,
          },
        },
        actor,
      ),
    ).rejects.toThrow('Settlement rows changed after CSV preflight');
    await expect(
      Promise.all([
        prisma.courierSettlementImport.count({
          where: { providerReportReference: 'csv-drift-report' },
        }),
        prisma.courierSettlement.count({
          where: { providerSettlementReference: 'csv-drift-report' },
        }),
        prisma.courierSettlementItem.count({
          where: { shipmentId: fixture.shipmentIds[0] },
        }),
      ]),
    ).resolves.toEqual([0, 0, 0]);
  });
});

function settlementDto(
  suffix: string,
  shipmentIds: string[],
  collectedAmounts: number[],
  remittedAmount: number,
) {
  return {
    provider: 'STEADFAST' as const,
    providerSettlementReference: `${suffix}-report`,
    bankReference: `bank-${suffix}`,
    remittedAmount,
    settledAt: '2026-08-11T12:00:00.000Z',
    items: shipmentIds.map((shipmentId, index) => ({
      shipmentId,
      collectedAmount: collectedAmounts[index],
      courierFee: 5000,
      otherDeduction: 0,
    })),
  };
}

function importDto(
  suffix: string,
  trackingNumbers: string[],
  providerRowReferences: string[],
  collectedAmounts: number[],
  remittedAmount: number,
) {
  return {
    provider: 'STEADFAST' as const,
    source: 'MANUAL_JSON' as const,
    providerReportReference: `${suffix}-report`,
    bankReference: `${suffix}-bank`,
    remittedAmount,
    settledAt: '2026-08-11T12:00:00.000Z',
    rows: trackingNumbers.map((trackingNumber, index) => ({
      providerRowReference: providerRowReferences[index],
      trackingNumber,
      collectedAmount: collectedAmounts[index],
      courierFee: 5000,
      otherDeduction: 0,
    })),
  };
}

async function createSettlementFixture(
  suffix: string,
  expectedAmounts: number[],
) {
  const provider = await prisma.shipmentProvider.upsert({
    where: { code: 'STEADFAST' },
    update: { isActive: true },
    create: {
      code: 'STEADFAST',
      name: 'Steadfast',
      baseUrl: 'https://steadfast.test',
      isActive: true,
    },
  });
  const shipmentIds: string[] = [];
  const orderIds: string[] = [];
  const trackingNumbers: string[] = [];
  for (const [index, expectedAmount] of expectedAmounts.entries()) {
    const unique = `${suffix}-${index}`;
    const customer = await prisma.customer.create({
      data: {
        name: `Settlement Customer ${unique}`,
        phoneOriginal: '01700000000',
        phoneNormalized: `+88018${suffix.length.toString().padStart(4, '0')}${index.toString().padStart(4, '0')}`,
      },
    });
    const cart = await prisma.cart.create({
      data: {
        tokenHash: hash(`settlement-cart-${unique}`),
        status: 'CONVERTED',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const zone = await prisma.deliveryZone.create({
      data: { name: `Settlement Zone ${unique}`, deliveryFee: 6000 },
    });
    const checkout = await prisma.checkoutDraft.create({
      data: {
        cartId: cart.id,
        deliveryZoneId: zone.id,
        name: customer.name,
        phoneOriginal: customer.phoneOriginal,
        phoneNormalized: customer.phoneNormalized,
        district: 'Dhaka',
        area: 'Dhanmondi',
        detailedAddress: 'Settlement integration address',
        termsAccepted: true,
        subtotal: expectedAmount - 6000,
        deliveryFee: 6000,
        total: expectedAmount,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const order = await prisma.order.create({
      data: {
        reference: `FER-SETTLEMENT-${unique.toUpperCase()}`,
        idempotencyKeyHash: hash(`settlement-order-${unique}`),
        status: 'DELIVERED',
        fulfillmentStatus: 'FULFILLED',
        shipmentStatus: 'DELIVERED',
        codVerification: 'VERIFIED',
        subtotal: expectedAmount - 6000,
        deliveryFee: 6000,
        total: expectedAmount,
        customerId: customer.id,
        checkoutDraftId: checkout.id,
      },
    });
    const shipment = await prisma.shipment.create({
      data: {
        status: 'DELIVERED',
        trackingNumber: `TRK-${unique.toUpperCase()}`,
        weightGrams: 500,
        codAmount: expectedAmount,
        requestPayload: { fixture: unique },
        responsePayload: { delivered: true },
        createdByActorId: actor.userId,
        deliveredAt: new Date('2026-08-10T12:00:00.000Z'),
        orderId: order.id,
        providerId: provider.id,
      },
    });
    await prisma.codCollection.create({
      data: {
        expectedAmount,
        expectedAt: new Date('2026-08-11T00:00:00.000Z'),
        shipmentId: shipment.id,
        orderId: order.id,
      },
    });
    shipmentIds.push(shipment.id);
    orderIds.push(order.id);
    trackingNumbers.push(shipment.trackingNumber!);
  }
  return { shipmentIds, orderIds, trackingNumbers };
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
