import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { UserPayload } from '../types/user-payload.type';

/**
 * Role Guard
 *
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 *
 * Checks if user has required role(s) to access route
 * Must be used after AuthGuard (user must be authenticated first)
 *
 * Usage:
 * @Roles('admin')
 * @UseGuards(AuthGuard, RolesGuard)
 * @Get('admin/users')
 * async getAllUsers() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (attached by AuthGuard)
    const request = context.switchToHttp().getRequest();
    const user: UserPayload = request.user;

    // User not authenticated (shouldn't happen if AuthGuard is first)
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has any of the required roles
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const delegatedStaffAccess =
      user.role === 'staff' &&
      requiredRoles.includes('admin') &&
      Boolean(requiredPermissions?.length);
    const hasRole =
      delegatedStaffAccess || requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    return true;
  }
}
