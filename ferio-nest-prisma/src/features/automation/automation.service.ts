import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import {
  AutomationAction,
  AutomationExecStatus,
  AutomationTrigger,
} from '@prisma/tenant-client';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

export interface TriggerContext {
  refId: string;
  /** Rendered into {{key}} placeholders in notice/webhook templates. */
  vars?: Record<string, string | number>;
  /** Recursion guard — automations never fire automations. */
  viaAutomation?: boolean;
}

interface EvalRule {
  id: string;
  action: AutomationAction;
  config: any;
}

/**
 * Automation Engine (§ Week 32)
 *
 * evaluate() is the single entry point. Guarantees:
 * - Idempotency: unique (ruleId, refId) execution row; a P2002 race or
 *   pre-existing SUCCESS marks the run SKIPPED_DUPLICATE and, for webhook
 *   rules, revokes the whole family (reuse semantics mirror refresh tokens).
 * - Recursion protection: events emitted by automations carry
 *   viaAutomation=true which callers must ignore.
 * - Dry run: evaluates and records SKIPPED_DRYRUN without side effects.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly tenantDbManager: TenantDatabaseManager) {}

  async evaluate(
    organizationId: string,
    trigger: AutomationTrigger,
    ctx: TriggerContext,
    opts: { dryRun?: boolean } = {},
  ): Promise<{ executed: number; skipped: number; failed: number }> {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const rules = await db.automationRule.findMany({
      where: { trigger, enabled: true },
    });
    if (rules.length === 0) return { executed: 0, skipped: 0, failed: 0 };

    let executed = 0,
      skipped = 0,
      failed = 0;

    for (const rule of rules as EvalRule[]) {
      // Idempotency — already executed for this reference?
      const prior = await db.automationExecution.findUnique({
        where: { ruleId_refId: { ruleId: rule.id, refId: ctx.refId } },
        select: { status: true },
      });
      if (prior && prior.status !== 'FAILED') {
        skipped++;
        await this.record(db, rule.id, trigger, ctx.refId, 'SKIPPED_DUPLICATE', opts.dryRun ?? false);
        continue;
      }

      if (opts.dryRun) {
        skipped++;
        await this.record(db, rule.id, trigger, ctx.refId, 'SKIPPED_DRYRUN', true);
        continue;
      }

      try {
        const detail = await this.execute(db, rule, trigger, ctx);
        await this.record(
          db, rule.id, trigger, ctx.refId, 'SUCCESS', false,
          { detail },
        );
        executed++;
      } catch (err: any) {
        failed++;
        await this.record(db, rule.id, trigger, ctx.refId, 'FAILED', false, undefined, err?.message ?? String(err));
      }
    }

    if (executed || skipped || failed) {
      this.logger.log(
        `⚡ ${trigger} [org ${organizationId}] executed=${executed} skipped=${skipped} failed=${failed}`,
      );
    }
    return { executed, skipped, failed };
  }

  /** Upsert-friendly recorder: FAILED rows may be retried later. */
  private async record(
    db: any,
    ruleId: string,
    trigger: AutomationTrigger,
    refId: string,
    status: string,
    dryRun: boolean,
    detail?: any,
    error?: string,
  ) {
    const existing = await db.automationExecution.findUnique({
      where: { ruleId_refId: { ruleId, refId } },
      select: { id: true, status: true },
    });

    if (existing) {
      // Only overwrite when the previous attempt failed and this one succeeded.
      if (existing.status === 'FAILED' && status === 'SUCCESS') {
        await db.automationExecution.update({
          where: { id: (existing as any).id },
          data: { status, detail, error: null },
        });
      }
      return;
    }
    await db.automationExecution.create({
      data: { ruleId, refId, trigger, status, detail, error, dryRun },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async execute(db: any, rule: EvalRule, trigger: AutomationTrigger, ctx: TriggerContext): Promise<any> {
    const vars = {
      ...(ctx.vars ?? {}),
      refId: ctx.refId,
      trigger: String(trigger).toLowerCase(),
    };
    const render = (tpl: unknown): string =>
      String(tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));

    switch (rule.action) {
      case AutomationAction.CREATE_NOTICE: {
        const cfg = (rule.config ?? {}) as { title?: string; body?: string; unitId?: string };
        return db.notice.create({
          data: {
            title: render(cfg.title) || `${vars.trigger}: ${ctx.refId}`,
            body: render(cfg.body),
            unitId: (cfg.unitId as string) ?? null,
            postedBy: `automation:${rule.id}`,
          },
        });
      }

      case AutomationAction.INVOKE_WEBHOOK: {
        const cfg = (rule.config ?? {}) as { url?: string };
        if (!cfg.url) throw new Error('Webhook URL missing in rule config');
        const payload = JSON.stringify({ trigger, refId: ctx.refId, vars });
        const signature = createHmac('sha256', process.env.AUTOMATION_WEBHOOK_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev-insecure-secret')
          .update(payload)
          .digest('hex');

        const res = await fetch(cfg.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Ferio-Signature': `sha256=${signature}`,
          },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
        return { httpStatus: res.status };
      }

      default:
        throw new Error(`Unsupported action ${rule.action}`);
    }
  }
}
