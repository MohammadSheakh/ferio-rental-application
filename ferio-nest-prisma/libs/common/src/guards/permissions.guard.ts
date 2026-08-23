import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Permission,
  roleHasPermission,
} from '../constants/permissions.constants';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { UserPayload } from '../types/user-payload.type';
import { StructuredLogger } from '../utils/structured-logger';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new StructuredLogger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserPayload | undefined;
    if (!user) {
      this.logger.warn('authorization_permission_rejected', {
        reason: 'USER_CONTEXT_MISSING',
        requiredPermissions,
      });
      throw new ForbiddenException('User not authenticated');
    }

    const missingPermissions = requiredPermissions.filter(
      (permission) =>
        !roleHasPermission(user.role, permission, user.permissions ?? []),
    );
    if (missingPermissions.length > 0) {
      this.logger.warn('authorization_permission_rejected', {
        reason: 'PERMISSION_MISSING',
        userId: user.userId,
        role: user.role,
        requiredPermissions,
        missingPermissions,
      });
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
