import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { Prisma } from '@prisma/tenant-client';

import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { ControlPlanePrismaService } from '../../infrastructure/control-plane/control-plane-prisma.service';

const RETRY_BASE_MS = Number(process.env.WEBHOOK_RETRY_BASE_MS || 30_000);
const MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS || 5);
const POLL_MS = Number(process.env.WEBHOOK_POLL_INTERVAL_MS || 10_000);
const TIMEOUT_MS = 10_000;
const CLAIM_LEASE_MS = Math.max(
  Number(process.env.WEBHOOK_CLAIM_LEASE_MS || 60_000),
  TIMEOUT_MS * 2,
);

/**
 * § Week 33 Outbound webhooks.
 *
 * Endpoints subscribe to event types; matching domain occurrences create
 * PENDING delivery rows which a background flusher POSTs with an
 * HMAC-SHA256 signature header. Failures retry with exponential backoff
 * and dead-letter after maxAttempts. Full delivery log is queryable and
 * replayable.
 */
@Injectable()
export class TenantWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantWebhookService.name);
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly controlPlane: ControlPlanePrismaService,
  ) {}

  onModuleInit() {
    if (process.env.WEBHOOK_WORKER_DISABLED === 'true') return;
    this.timer = setInterval(() => void this.flushAll(), POLL_MS);
    this.timer.unref?.();
    this.logger.log(
      `🪝 Webhook worker started (interval=${POLL_MS}ms, backoff base=${RETRY_BASE_MS}ms)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Endpoint management ──

  async assertOwner(role?: string) {
    if (role !== 'ORGANIZATION_OWNER') {
      throw new ForbiddenException('Only ORGANIZATION_OWNER can manage webhooks');
    }
  }

  async createEndpoint(organizationId: string, input: {
    url: string; events: string[]; description?: string;
  }) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    try {
      new URL(input.url);
    } catch {
      throw new BadRequestException('url must be a valid absolute URL');
    }
    if (!input.events?.length) {
      throw new BadRequestException('events[] is required');
    }
    const secret = randomBytes(24).toString('hex');
    const endpoint = await db.webhookEndpoint.create({
      data: {
        url: input.url,
        events: input.events,
        description: input.description ?? null,
        secret,
      },
      select: { id: true, url: true, events: true, enabled: true },
    });
    // The secret is shown once — same trust model as API keys.
    return { ...endpoint, secret };
  }

  async listEndpoints(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.webhookEndpoint.findMany({
      select: { id: true, url: true, events: true, enabled: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteEndpoint(organizationId: string, endpointId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const row = await db.webhookEndpoint.findUnique({ where: { id: endpointId } });
    if (!row) throw new NotFoundException('Webhook endpoint not found');
    await db.webhookEndpoint.delete({ where: { id: endpointId } });
    return { deleted: true };
  }

  async toggleEndpoint(organizationId: string, endpointId: string, enabled: boolean) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.webhookEndpoint.update({
      where: { id: endpointId },
      data: { enabled },
      select: { id: true, enabled: true },
    });
  }

  // ── Delivery log ──

  async listDeliveries(organizationId: string, opts?: { endpointId?: string; status?: string }) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.webhookDelivery.findMany({
      where: {
        ...(opts?.endpointId ? { endpointId: opts.endpointId } : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { endpoint: { select: { url: true } } },
    });
  }

  async redeliver(organizationId: string, deliveryId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const row = await db.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!row) throw new NotFoundException('Delivery not found');
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), error: null, responseCode: null, deliveredAt: null },
    });
    void this.flushOrganization(organizationId).catch(() => {});
    return { requeued: true };
  }

  // ── Emission ──

  /** Best-effort fan-out to subscribed endpoints. Never throws. */
  async emit(organizationId: string, event: string, payload: Record<string, unknown>) {
    try {
      const db = await this.tenantDbManager.getTenantDatabase(organizationId);
      const endpoints = await db.webhookEndpoint.findMany({
        where: { enabled: true, events: { has: event } },
        select: { id: true },
      });
      if (!endpoints.length) return;
      await db.webhookDelivery.createMany({
        data: endpoints.map((e) => ({
          endpointId: e.id,
          event,
          payload: { event, organizationId, ...payload } as any,
          nextAttemptAt: new Date(),
        })),
      });
      this.logger.log(`🪝 queued "${event}" → ${endpoints.length} endpoint(s)`);
    } catch (err) {
      this.logger.warn(`webhook emit failed for ${event}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Flush worker ──

  private async flushAll() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const orgs = await this.controlPlane.saasOrganization.findMany({
        where: { status: 'ACTIVE', database: { status: 'READY' } },
        select: { id: true },
      });
      let delivered = 0;
      for (const org of orgs) {
        try {
          const before = await this.countSettled(org.id);
          await this.flushOrganization(org.id);
          const after = await this.countSettled(org.id);
          delivered += after - before;
        } catch {
          // unreachable tenant DB — retry next cycle
        }
      }
      if (delivered > 0) {
        this.logger.log(`🪝 Webhook cycle: ${delivered} delivery attempt(s) resolved`);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async countSettled(organizationId: string): Promise<number> {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.webhookDelivery.count({ where: { status: { in: ['SUCCESS', 'FAILED'] } } });
  }

  /** Attempt every due delivery across one tenant DB. */
  async flushOrganization(organizationId: string) {
    let db: Awaited<ReturnType<TenantDatabaseManager['getTenantDatabase']>>;
    try {
      db = await this.tenantDbManager.getTenantDatabase(organizationId);
    } catch {
      return;
    }
    // Atomically lease rows before network I/O. A crashed worker's lease
    // expires and becomes claimable again on a later cycle.
    const leaseUntil = new Date(Date.now() + CLAIM_LEASE_MS);
    const claims = await db.$queryRaw<Array<{
      id: string; endpointId: string; event: string; payload: unknown;
      attempts: number; maxAttempts: number;
      endpointUrl: string; endpointSecret: string; endpointEnabled: boolean;
    }>>(
      Prisma.sql`
        WITH due AS (
          SELECT d."id"
          FROM "WebhookDelivery" d
          WHERE
            (d.status = 'PENDING' AND d."nextAttemptAt" <= now())
            OR (d.status = 'PROCESSING' AND d."nextAttemptAt" <= now())
          ORDER BY d."nextAttemptAt"
          LIMIT 50
          FOR UPDATE OF d SKIP LOCKED
        ), claimed AS (
          UPDATE "WebhookDelivery" d
          SET status = 'PROCESSING', "nextAttemptAt" = ${leaseUntil}
          FROM due
          WHERE d."id" = due."id"
          RETURNING d."id", d."endpointId", d."event", d.payload,
                    d.attempts, d."maxAttempts"
        )
        SELECT c.*, e.url AS "endpointUrl", e.secret AS "endpointSecret",
               e.enabled AS "endpointEnabled"
        FROM claimed c
        JOIN "WebhookEndpoint" e ON e.id = c."endpointId"
      `,
    );

    for (const d of claims) {
      if (!d.endpointEnabled) {
        await db.webhookDelivery.update({
          where: { id: d.id },
          data: { status: 'PENDING', nextAttemptAt: new Date(Date.now() + RETRY_BASE_MS) },
        }).catch(() => {});
        continue;
      }
      const body = JSON.stringify(d.payload);
      const signature = createHmac('sha256', d.endpointSecret).update(body).digest('hex');
      let okCode: number | null = null;
      let errorText: string | null = null;
      try {
        const controller = new AbortController();
        const t = setTimeout((c) => c.abort(), TIMEOUT_MS, controller);
        const res = await fetch(d.endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Ferio-Signature': `sha256=${signature}`,
            'X-Ferio-Event': d.event,
            'X-Ferio-Delivery': d.id,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(t);
        okCode = res.status;
        if (res.status >= 300) errorText = `HTTP ${res.status}`;
      } catch (err) {
        errorText = err instanceof Error ? err.message : String(err);
      }

      const attempts = d.attempts + 1;
      const success = okCode != null && okCode >= 200 && okCode < 300;

      if (success) {
        await db.webhookDelivery.update({
          where: { id: d.id },
          data: { status: 'SUCCESS', attempts, responseCode: okCode, deliveredAt: new Date(), error: null },
        });
      } else if (attempts >= Math.min(d.maxAttempts, MAX_ATTEMPTS)) {
        await db.webhookDelivery.update({
          where: { id: d.id },
          data: { status: 'FAILED', attempts, responseCode: okCode, error: errorText },
        });
      } else {
        const delayMs = RETRY_BASE_MS * 2 ** attempts;
        await db.webhookDelivery.update({
          where: { id: d.id },
          data: {
            status: 'PENDING',
            attempts,
            responseCode: okCode,
            error: errorText,
            nextAttemptAt: new Date(Date.now() + delayMs),
          },
        });
      }
    }
  }
}
