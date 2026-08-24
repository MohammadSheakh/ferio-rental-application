import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from 'pg';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { StorageService } from '../storage/storage.service';

/**
 * § Week 36 Tenant DB Operations.
 *
 * Physical backups via `pg_dump -Fc` stored through StorageService
 * (S3-compatible in prod, local disk in dev), readability verification
 * with `pg_restore --list`, clone-to-staging by restoring into a fresh
 * database, and org archive/unarchive (resolver-level lockout).
 */
@Injectable()
export class TenantDbOpsService {
  private readonly logger = new Logger(TenantDbOpsService.name);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly storage: StorageService,
  ) {}

  private tenantUrl(db: { host: string; port: number; username: string; databaseName: string; sslMode: string }): string {
    const password =
      process.env.TENANT_DB_PASSWORD ||
      process.env.TENANT_DB_DEFAULT_PASSWORD ||
      'postgres';
    // pg_dump honours sslmode strictly (no silent fallback) — prefer lets
    // it connect to both TLS and plain servers, matching Prisma's mapping.
    return `postgresql://${db.username}:${encodeURIComponent(password)}@${db.host}:${db.port}/${db.databaseName}?sslmode=prefer`;
  }

  private async resolveOrg(orgId: string) {
    const org = await this.controlPlane.saasOrganization.findUnique({
      where: { id: orgId },
      include: { database: true, subscription: { select: { status: true } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.database) throw new BadRequestException('Organization has no registered tenant database');
    return org;
  }

  private run(cmd: string, args: string[], envExtra: Record<string, string> = {}) {
    const res = spawnSync(cmd, args, {
      encoding: 'utf8',
      env: { ...process.env, ...envExtra },
      timeout: 120_000,
    });
    return res;
  }

  /** Physical backup of a tenant DB → StorageService. */
  async createBackup(
    organizationId: string,
    input: { type?: string; note?: string; createdBy?: string },
  ) {
    const org = await this.resolveOrg(organizationId);
    const db = org.database!;
    const url = this.tenantUrl(db as never);

    const tmp = mkdtempSync(join(tmpdir(), 'ferio-bak-'));
    const file = join(tmp, `${db.databaseName}.dump`);
    const res = this.run('pg_dump', ['-Fc', '--no-owner', '-d', url, '-f', file]);
    if (res.status !== 0) {
      rmSync(tmp, { recursive: true, force: true });
      throw new Error(`pg_dump failed: ${String(res.stderr).slice(0, 300)}`);
    }

    const buffer = readFileSync(file);
    const key = `backups/${organizationId}/${Date.now()}-${db.databaseName}.dump`;
    const stored = await (this.storage as any).putRawObject(key, buffer);
    void stored;

    // Count tables for the record
    const tableCount = await this.countTables({
      host: db.host, port: db.port, username: db.username, databaseName: db.databaseName,
    });
    rmSync(tmp, { recursive: true, force: true });

    const row = await this.controlPlane.tenantBackup.create({
      data: {
        organizationId,
        databaseName: db.databaseName,
        storageKey: key,
        sizeBytes: BigInt(buffer.byteLength),
        tableCount,
        type: input.type ?? 'MANUAL',
        note: input.note ?? null,
        createdBy: input.createdBy ?? null,
        status: 'COMPLETED',
      },
    });

    this.logger.log(
      `💾 Backup ${row.id} of ${db.databaseName}: ${(buffer.byteLength / 1024).toFixed(1)}KB · ${tableCount} tables`,
    );
    return this.publicView(row);
  }

  async listBackups(organizationId?: string) {
    const rows = await this.controlPlane.tenantBackup.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: { organization: { select: { slug: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.publicView(r));
  }

  /**
   * Readability proof: pull the object back and run `pg_restore --list`
   * against it — validates the archive without touching any live DB.
   */
  async verifyBackup(backupId: string) {
    const backup = await this.controlPlane.tenantBackup.findUnique({
      where: { id: backupId },
    });
    if (!backup) throw new NotFoundException('Backup not found');

    const buffer = await (this.storage as any).getRawObject(backup.storageKey);
    const tmp = mkdtempSync(join(tmpdir(), 'ferio-verify-'));
    const file = join(tmp, 'backup.dump');
    writeFileSync(file, buffer);

    const res = this.run('pg_restore', ['--list', file]);
    rmSync(tmp, { recursive: true, force: true });
    if (res.status !== 0) {
      throw new Error(`Backup unreadable: ${String(res.stderr).slice(0, 300)}`);
    }
    const tables = (res.stdout.match(/TABLE DATA/g) ?? []).length;

    await this.controlPlane.tenantBackup.update({
      where: { id: backupId },
      data: { verifiedAt: new Date() },
    });
    return { backupId, readable: true, tableEntries: tables };
  }

  /**
   * Clone-to-staging: restore the backup into a brand-new database and
   * report its table count + connection name. The clone is NOT wired
   * into the tenant manager — it is a standalone inspection copy.
   */
  async cloneFromBackup(backupId: string) {
    const backup = await this.controlPlane.tenantBackup.findUnique({
      where: { id: backupId },
    });
    if (!backup) throw new NotFoundException('Backup not found');

    const buffer = await (this.storage as any).getRawObject(backup.storageKey);
    const cloneName = `${backup.databaseName}_clone_${Date.now().toString(36)}`;

    // Resolve server credentials from an existing TenantDatabase row
    const dbRow = await this.controlPlane.tenantDatabase.findFirst({
      where: { databaseName: backup.databaseName },
    });
    if (!dbRow) throw new NotFoundException('Source database row not found');

    const admin = new Client({
      host: dbRow.host,
      port: dbRow.port,
      user: dbRow.username,
      password:
        process.env.TENANT_DB_PASSWORD ||
        process.env.TENANT_DB_DEFAULT_PASSWORD ||
        'postgres',
    });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${cloneName}"`);
    } finally {
      await admin.end();
    }

    const url = this.tenantUrl({
      host: dbRow.host,
      port: dbRow.port,
      username: dbRow.username,
      sslMode: dbRow.sslMode,
      databaseName: cloneName,
    });

    // Convert to plain SQL so we can strip newer-server-only statements
    // (e.g. PG17's `SET transaction_timeout`) before applying to older targets.
    const tmp = mkdtempSync(join(tmpdir(), 'ferio-clone-'));
    const file = join(tmp, 'backup.dump');
    writeFileSync(file, buffer);
    const sqlFile = join(tmp, 'backup.sql');
    const toSql = this.run('pg_restore', ['-f', sqlFile, '--no-owner', file]);
    if (toSql.status !== 0) {
      rmSync(tmp, { recursive: true, force: true });
      throw new Error(`pg_restore to sql failed: ${String(toSql.stderr).slice(0, 300)}`);
    }
    const filtered = readFileSync(sqlFile, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*SET\s+transaction_timeout\b/.test(line))
      .join('\n');
    writeFileSync(sqlFile, filtered);

    const res = this.run(
      'psql',
      ['-v', 'ON_ERROR_STOP=0', '-q', '-d', url, '-f', sqlFile],
    );
    rmSync(tmp, { recursive: true, force: true });

    if (res.status !== 0) {
      throw new Error(`restore apply failed: ${String(res.stderr).slice(0, 300)}`);
    }

    const tableCount = await this.countTables({
      host: dbRow.host, port: dbRow.port, username: dbRow.username, databaseName: cloneName,
    });
    await this.controlPlane.tenantBackup.update({
      where: { id: backupId },
      data: { restoredToDbName: cloneName },
    });
    this.logger.log(`🧬 Clone ready: ${cloneName} (${tableCount} tables)`);
    return { cloneName, tableCount, connectionDatabase: cloneName };
  }

  /**
   * § Archive: flip the tenant DB to DISABLED → resolver refuses to serve
   * the org, pooled connections are dropped. Fully reversible.
   */
  async setArchived(organizationId: string, archived: boolean) {
    const org = await this.resolveOrg(organizationId);
    if (!org.subscription || !['ACTIVE', 'PAST_DUE', 'CANCELLED'].includes((org.subscription as any).status)) {
      // Archiving a provisioned DB is still allowed; just log unusual states.
      this.logger.warn(`Archiving org ${org.slug} with subscription state ${(org.subscription as any)?.status ?? 'none'}`);
    }
    const updated = await this.controlPlane.tenantDatabase.update({
      where: { id: org.database!.id },
      data: { status: archived ? 'DISABLED' : 'READY' },
    });
    await this.tenantDbManager.disconnectTenant(organizationId).catch(() => {});
    this.logger.log(`🗄️ Org ${org.slug} database → ${updated.status}`);
    return { organizationId, slug: org.slug, databaseStatus: updated.status };
  }

  /** Connection + fleet metrics for the ops dashboard. */
  async metrics() {
    const pool = this.tenantDbManager.getPoolStats();
    const [byStatus, backups] = await Promise.all([
      this.controlPlane.tenantDatabase.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.controlPlane.tenantBackup.aggregate({ _count: { _all: true }, _sum: { sizeBytes: true } }),
    ]);
    return {
      pooledConnections: pool,
      databasesByStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count._all]),
      ),
      backups: {
        total: backups._count._all,
        totalBytes: Number(backups._sum.sizeBytes ?? 0),
      },
    };
  }

  /** node-pg ≥8 treats sslmode=prefer strictly — connect directly, no SSL,
   *  unless the deployment opts into TLS via TENANT_DB_SSL=true. */
  private countTables(target: {
    host: string; port: number; username: string; databaseName: string;
  }): Promise<number> {
    return new Promise((resolve, reject) => {
      const c = new Client({
        host: target.host,
        port: target.port,
        user: target.username,
        password:
          process.env.TENANT_DB_PASSWORD ||
          process.env.TENANT_DB_DEFAULT_PASSWORD ||
          'postgres',
        database: target.databaseName,
        ssl: process.env.TENANT_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });
      c.connect()
        .then(async () => {
          const r = await c.query(
            `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
          );
          await c.end();
          resolve(r.rows[0].n);
        })
        .catch((e) => {
          c.end().catch(() => {});
          reject(e);
        });
    });
  }

  private publicView(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      databaseName: row.databaseName,
      sizeBytes: Number(row.sizeBytes ?? 0),
      tableCount: row.tableCount,
      type: row.type,
      status: row.status,
      note: row.note,
      verifiedAt: row.verifiedAt,
      restoredToDbName: row.restoredToDbName,
      createdAt: row.createdAt,
    };
  }

  /**
   * § Week 36 data-portability export — the organization's core
   * operational data as a single JSON document.
   */
  async exportOrganization(organizationId: string) {
    const org = await this.resolveOrg(organizationId);
    const db = org.database as never as {
      host: string; port: number; username: string; databaseName: string; sslMode: string;
    };
    const c = new Client({
      host: db.host,
      port: db.port,
      user: db.username,
      password:
        process.env.TENANT_DB_PASSWORD ||
        process.env.TENANT_DB_DEFAULT_PASSWORD ||
        'postgres',
      database: db.databaseName,
      ssl: process.env.TENANT_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    await c.connect();
    try {
      const grab = async (sql: string) => (await c.query(sql)).rows;
      const [properties, buildings, units, rooms, renters, leases, billingAccounts, invoices, invoiceLines, payments, utilityAccounts, meters, meterReadings, maintenanceRequests, workOrders, members] =
        await Promise.all([
          grab(`SELECT * FROM "Property" ORDER BY "createdAt"`),
          grab(`SELECT * FROM "Building" ORDER BY "createdAt"`),
          grab(`SELECT * FROM "Unit" ORDER BY "createdAt"`),
          grab(`SELECT * FROM "UnitRoom" ORDER BY "sortOrder"`),
          grab(`SELECT * FROM "Renter" ORDER BY "createdAt"`),
          grab(`SELECT id, "unitId", status, "startDate", "endDate", "monthlyRent", "securityDeposit", "createdAt" FROM "Lease" ORDER BY "startDate"`),
          grab(`SELECT ba.id, ba."unitId" FROM "BillingAccount" ba`),
          grab(`SELECT i.id, i."invoiceNumber", i.status, i."totalAmount", i."paidAmount", i."dueDate", i."periodStart", i."periodEnd" FROM "Invoice" i ORDER BY i."periodStart"`),
          grab(`SELECT id, "invoiceId", category, label, amount FROM "InvoiceLine"`),
          grab(`SELECT p.id, p."invoiceId", p.method, p.amount, p.status, p."receiptNumber", p."paidAt" FROM "Payment" p ORDER BY p."createdAt"`),
          grab(`SELECT * FROM "UtilityAccount"`),
          grab(`SELECT * FROM "Meter"`),
          grab(`SELECT * FROM "MeterReading" ORDER BY "readingDate"`),
          grab(`SELECT id, title, status, urgency, payer, "estimatedCost", "actualCost", "createdAt", "resolvedAt" FROM "MaintenanceRequest" ORDER BY "createdAt"`),
          grab(`SELECT id, "maintenanceRequestId", status, "assignedTo", cost, "estimatedCost", "completedAt" FROM "WorkOrder"`),
          grab(`SELECT id, role, status FROM "Member"`),
        ]);
      void invoiceLines;
      return {
        format: 'ferio-export-v1',
        exportedAt: new Date().toISOString(),
        organization: { id: org.id, slug: org.slug, name: org.name },
        counts: {
          properties: properties.length,
          invoiceLines: invoiceLines.length,
          units: units.length,
          renters: renters.length,
          leases: leases.length,
          invoices: invoices.length,
          payments: payments.length,
          maintenanceRequests: maintenanceRequests.length,
        },
        data: {
          properties,
          buildings,
          units,
          unitRooms: rooms,
          renters,
          leases,
          billingAccounts,
          invoices,
          payments,
          utilityAccounts,
          meters,
          meterReadings,
          maintenanceRequests,
          workOrders,
          members,
        },
      };
    } finally {
      await c.end().catch(() => {});
    }
  }

}