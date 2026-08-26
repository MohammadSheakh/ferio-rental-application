import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { EntitlementService } from '../entitlements/entitlement.service';
import {
  OrganizationStatus,
  SubscriptionStatus,
  PlanTier,
} from '@prisma/control-client';

type SubscriptionEventType =
  | 'CREATED'
  | 'RENEWED'
  | 'UPGRADED'
  | 'DOWNGRADED'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'REACTIVATED'
  | 'PAST_DUE';

/**
 * Subscription Lifecycle Service (Week 8 / §15)
 *
 * Owns every subscription state transition. Each mutation:
 * - validates the transition against the §15 policy,
 * - writes a `SubscriptionEvent` row (fromPlan/toPlan where relevant),
 * - writes a platform audit event,
 * - cascades organization status so the tenant resolver enforces it,
 * - flushes entitlement caches on plan changes.
 */
@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly entitlements: EntitlementService,
  ) {}

  /** Extend the period by one month; reactivates PAST_DUE on payment. */
  async renew(organizationId: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status as SubscriptionStatus, [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.TRIALING,
    ]);

    const base =
      sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const nextEnd = new Date(base);
    nextEnd.setMonth(nextEnd.getMonth() + 1);

    const [updated] = await this.apply(organizationId, sub, {
      status:
        sub.status === SubscriptionStatus.PAST_DUE
          ? SubscriptionStatus.ACTIVE
          : undefined,
      currentPeriodStart: base,
      currentPeriodEnd: nextEnd,
    }, 'RENEWED');

    await this.syncOrganizationStatus(organizationId, OrganizationStatus.ACTIVE);
    return updated;
  }

  async cancel(organizationId: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status as SubscriptionStatus, [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.SUSPENDED,
    ], 'cancel');

    const updated = await this.controlPlane.subscription.update({
      where: { organizationId },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    });
    await this.recordEvent(updated.id, 'CANCELLED', sub.planId);
    // §15: CANCELLED keeps data with an export window — org stays readable
    // but the resolver already blocks CANCELLED tenants.
    await this.syncOrganizationStatus(organizationId, OrganizationStatus.CANCELLED);
    return updated;
  }

  async markPastDue(organizationId: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status as SubscriptionStatus, [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
    ], 'markPastDue');

    const updated = await this.controlPlane.subscription.update({
      where: { organizationId },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
    await this.recordEvent(updated.id, 'PAST_DUE', sub.planId);
    await this.syncOrganizationStatus(organizationId, OrganizationStatus.PAST_DUE);
    return updated;
  }

  /** Grace expired → read-only/restricted access. */
  async suspend(organizationId: string, reason?: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status as SubscriptionStatus, [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAST_DUE,
    ], 'suspend');

    const updated = await this.controlPlane.subscription.update({
      where: { organizationId },
      data: { status: SubscriptionStatus.SUSPENDED },
    });
    await this.recordEvent(updated.id, 'SUSPENDED', sub.planId);

    // Cascade: resolver blocks SUSPENDED orgs outright.
    const org = await this.controlPlane.saasOrganization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.SUSPENDED },
    });
    await this.controlPlane.platformAuditEvent.create({
      data: {
        action: 'subscription.suspended',
        actorType: 'SYSTEM',
        resourceType: 'Subscription',
        resourceId: sub.id,
        organizationId,
        metadata: { reason: reason ?? null, slug: org.slug },
      },
    }).catch(() => {});

    // Release pooled connection + caches for the blocked org.
    await this.tenantDbManager.disconnectTenant(organizationId).catch(() => {});
    this.entitlements.invalidate(organizationId);
    return updated;
  }

  async reactivate(organizationId: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status as SubscriptionStatus, [
      SubscriptionStatus.SUSPENDED,
      SubscriptionStatus.CANCELLED,
    ], 'reactivation');

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);

    const updated = await this.controlPlane.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
    });
    await this.recordEvent(updated.id, 'REACTIVATED', sub.planId);
    await this.syncOrganizationStatus(organizationId, OrganizationStatus.ACTIVE);
    return updated;
  }

  /** Upgrade/downgrade plan mid-cycle. */
  async changePlan(organizationId: string, targetTier: keyof typeof PlanTier) {
    const sub = await this.getSubscription(organizationId);
    if (
      !([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] as SubscriptionStatus[]).includes(
        sub.status as SubscriptionStatus,
      )
    ) {
      throw new ConflictException(`Cannot change plan while ${sub.status}`);
    }

    const target = await this.controlPlane.plan.findFirst({
      where: { tier: targetTier as any },
    });
    if (!target) throw new NotFoundException(`Plan tier ${targetTier} not found`);
    if (target.id === sub.planId) return sub;

    const order: string[] = [
      'FREE_LISTING',
      'STARTER',
      'PRO',
      'BUSINESS',
      'ENTERPRISE',
    ];
    const isUpgrade = order.indexOf(target.tier) > order.indexOf(sub.plan?.tier ?? '');

    const updated = await this.controlPlane.subscription.update({
      where: { organizationId },
      data: { planId: target.id },
      include: { plan: true },
    });

    await this.controlPlane.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        eventType: isUpgrade ? 'UPGRADED' : 'DOWNGRADED',
        fromPlanId: sub.planId,
        toPlanId: target.id,
      },
    });
    this.entitlements.invalidate(organizationId);

    await this.controlPlane.platformAuditEvent.create({
      data: {
        action: `subscription.${isUpgrade ? 'upgraded' : 'downgraded'}`,
        actorType: 'PLATFORM_USER',
        resourceType: 'Subscription',
        resourceId: sub.id,
        organizationId,
        metadata: { from: sub.plan?.tier, to: target.tier },
      },
    }).catch(() => {});

    return updated;
  }

  /**
   * Period-end scan: ACTIVE subscriptions past their period become
   * PAST_DUE (grace window starts). Run from CronJobsService.
   */
  async scanForPastDue(): Promise<{ scanned: number; markedPastDue: number }> {
    const overdue = await this.controlPlane.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lt: new Date() },
      },
      select: { organizationId: true },
    });

    let marked = 0;
    for (const { organizationId } of overdue) {
      try {
        await this.markPastDue(organizationId);
        marked++;
      } catch (err) {
        this.logger.warn(
          `Past-due scan skipped ${organizationId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { scanned: overdue.length, markedPastDue: marked };
  }

  // ────────────────────────────────────────────────────────────

  private async getSubscription(organizationId: string) {
    const sub = await this.controlPlane.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Organization has no subscription');
    return sub;
  }

  private assertTransition(
    current: SubscriptionStatus,
    allowedFrom: SubscriptionStatus[],
    action = 'transition',
  ): void {
    if (!allowedFrom.includes(current)) {
      throw new ConflictException(
        `Cannot ${action} from ${current}. Allowed from: ${allowedFrom.join(', ')}`,
      );
    }
  }

  private async apply(
    organizationId: string,
    sub: { id: string; status: string; planId: string },
    data: Record<string, unknown>,
    eventType: SubscriptionEventType,
  ) {
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );
    const updated = await this.controlPlane.subscription.update({
      where: { organizationId },
      data: patch as any,
    });
    await this.recordEvent(sub.id, eventType, sub.planId);
    return [updated];
  }

  private recordEvent(
    subscriptionId: string,
    eventType: SubscriptionEventType,
    planId: string,
    extra?: { fromPlanId?: string },
  ): Promise<unknown> {
    return this.controlPlane.subscriptionEvent
      .create({
        data: {
          subscriptionId,
          eventType,
          toPlanId: planId,
          ...extra,
        },
      })
      .catch(() => {});
  }

  private syncOrganizationStatus(id: string, status: OrganizationStatus): Promise<unknown> {
    return this.controlPlane.saasOrganization
      .update({ where: { id }, data: { status } })
      .then((org) => {
        this.entitlements.invalidate(id);
        return org;
      })
      .catch(() => {});
  }
}
