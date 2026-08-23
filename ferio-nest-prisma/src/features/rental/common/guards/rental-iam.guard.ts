import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@app/database';

export const RENTAL_PERMISSIONS_KEY = 'rental_permissions';

@Injectable()
export class RentalIamGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      RENTAL_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.sub;
    const orgId = request.headers['x-organization-id'] || request.query?.organizationId || request.body?.organizationId;

    if (!userId) {
      throw new ForbiddenException('User authentication required.');
    }

    if (!orgId) {
      // If endpoint doesn't require org-specific scoping and no permissions are required, pass
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }
      throw new ForbiddenException('Organization context header x-organization-id is missing.');
    }

    // 1. Verify Organization Membership
    const member = await this.prisma.rentalOrganizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('User is not an active member of this rental organization.');
    }

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 2. Extract direct role permissions
    const userPermissionCodes = new Set<string>();
    if (member.role) {
      member.role.permissions.forEach((rp) => userPermissionCodes.add(rp.permission.code));
    }

    // Check if user has all required permissions directly
    const hasDirectPermissions = requiredPermissions.every((perm) => userPermissionCodes.has(perm));
    if (hasDirectPermissions) {
      return true;
    }

    // 3. Check for Active Delegations (Temporary grants for property managers / staff)
    const now = new Date();
    const activeDelegations = await this.prisma.rentalDelegation.findMany({
      where: {
        organizationId: orgId,
        granteeUserId: userId,
        status: 'ACTIVE',
        effectiveFrom: { lte: now },
        effectiveTo: { gte: now },
      },
    });

    const delegatedPermissions = new Set<string>();
    activeDelegations.forEach((del) => {
      del.permissions.forEach((p) => delegatedPermissions.add(p));
    });

    const hasDelegatedPermissions = requiredPermissions.every(
      (perm) => userPermissionCodes.has(perm) || delegatedPermissions.has(perm),
    );

    if (!hasDelegatedPermissions) {
      throw new ForbiddenException(
        `Insufficient permissions for this operation. Required: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
