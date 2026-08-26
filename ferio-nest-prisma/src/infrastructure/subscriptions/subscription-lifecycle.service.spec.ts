import { ConflictException } from '@nestjs/common';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

describe('SubscriptionLifecycleService plan changes', () => {
  const controlPlane = {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    plan: { findFirst: jest.fn() },
    subscriptionEvent: { create: jest.fn() },
    platformAuditEvent: { create: jest.fn() },
  };
  const entitlements = { invalidate: jest.fn() };
  const tenantDbManager = {};

  let service: SubscriptionLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubscriptionLifecycleService(
      controlPlane as any,
      tenantDbManager as any,
      entitlements as any,
    );
    controlPlane.plan.findFirst.mockResolvedValue({ id: 'plan-pro', tier: 'PRO' });
    controlPlane.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      planId: 'plan-pro',
      plan: { id: 'plan-pro', tier: 'PRO' },
    });
    controlPlane.subscriptionEvent.create.mockResolvedValue({});
    controlPlane.platformAuditEvent.create.mockResolvedValue({});
  });

  it('allows an active subscription to upgrade mid-cycle', async () => {
    controlPlane.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      planId: 'plan-starter',
      plan: { id: 'plan-starter', tier: 'STARTER' },
    });

    const result = await service.changePlan('org-1', 'PRO');

    expect(result.plan.tier).toBe('PRO');
    expect(controlPlane.subscription.update).toHaveBeenCalled();
    expect(entitlements.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('rejects plan changes for a cancelled subscription', async () => {
    controlPlane.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELLED',
      planId: 'plan-starter',
      plan: { id: 'plan-starter', tier: 'STARTER' },
    });

    await expect(service.changePlan('org-1', 'PRO')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(controlPlane.subscription.update).not.toHaveBeenCalled();
  });
});
