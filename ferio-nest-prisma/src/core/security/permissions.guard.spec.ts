import { ForbiddenException } from '@nestjs/common';
import {
  PERMISSIONS,
  PermissionsGuard,
  RolesGuard,
  roleHasPermission,
} from '@app/common';

describe('explicit permission authorization', () => {
  function contextFor(user?: {
    userId: string;
    email: string;
    role: string;
    permissions?: string[];
  }) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };
  }

  function guardFor(requiredPermissions = [PERMISSIONS.REFUNDS_MANAGE]) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions),
    };
    const guard = new PermissionsGuard(reflector as never);
    const logger = { warn: jest.fn() };
    (guard as unknown as { logger: typeof logger }).logger = logger;
    return { guard, logger };
  }

  it('derives permissions from the server-owned role matrix', () => {
    expect(roleHasPermission('admin', PERMISSIONS.REFUNDS_MANAGE)).toBe(true);
    expect(roleHasPermission('user', PERMISSIONS.REFUNDS_MANAGE)).toBe(false);
    expect(
      roleHasPermission('delivery_man', PERMISSIONS.SHIPPING_PROVIDER_MANAGE),
    ).toBe(false);
    expect(roleHasPermission('unknown', PERMISSIONS.AUDIT_READ)).toBe(false);
  });

  it('allows an administrator with the required permission', () => {
    const { guard, logger } = guardFor();

    expect(
      guard.canActivate(
        contextFor({
          userId: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
        }) as never,
      ),
    ).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('allows staff only when the permission is present in signed claims', () => {
    const { guard } = guardFor([PERMISSIONS.REFUNDS_MANAGE]);

    expect(
      guard.canActivate(
        contextFor({
          userId: 'staff-1',
          email: 'staff@example.com',
          role: 'staff',
          permissions: [PERMISSIONS.REFUNDS_MANAGE],
        }) as never,
      ),
    ).toBe(true);
  });

  it('delegates admin role boundaries to staff only on permissioned routes', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(['admin'])
        .mockReturnValueOnce([PERMISSIONS.REFUNDS_MANAGE]),
    };
    const guard = new RolesGuard(reflector as never);

    expect(
      guard.canActivate(
        contextFor({
          userId: 'staff-1',
          email: 'staff@example.com',
          role: 'staff',
        }) as never,
      ),
    ).toBe(true);
  });

  it('rejects a role without permission and omits email from evidence', () => {
    const { guard, logger } = guardFor();

    expect(() =>
      guard.canActivate(
        contextFor({
          userId: 'customer-1',
          email: 'private-customer@example.com',
          role: 'user',
        }) as never,
      ),
    ).toThrow(ForbiddenException);
    expect(logger.warn).toHaveBeenCalledWith(
      'authorization_permission_rejected',
      {
        reason: 'PERMISSION_MISSING',
        userId: 'customer-1',
        role: 'user',
        requiredPermissions: [PERMISSIONS.REFUNDS_MANAGE],
        missingPermissions: [PERMISSIONS.REFUNDS_MANAGE],
      },
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private-customer@example.com',
    );
  });

  it('rejects missing authenticated context', () => {
    const { guard, logger } = guardFor([PERMISSIONS.CUSTOMERS_READ]);

    expect(() => guard.canActivate(contextFor() as never)).toThrow(
      ForbiddenException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'authorization_permission_rejected',
      {
        reason: 'USER_CONTEXT_MISSING',
        requiredPermissions: [PERMISSIONS.CUSTOMERS_READ],
      },
    );
  });

  it('allows routes without permission metadata', () => {
    const { guard } = guardFor([]);
    expect(guard.canActivate(contextFor() as never)).toBe(true);
  });
});
