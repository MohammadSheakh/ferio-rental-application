import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { createParamDecorator } from '@nestjs/common';

export const PLATFORM_ROLES_KEY = 'platform_roles';

/** JWT payload for platform-realm tokens. */
export interface StaffPayload {
  sub: string;
  userId: string;
  email: string;
  displayName?: string;
  realm: 'platform';
  role: PlatformRole | string;
}

/** `@CurrentStaff()` parameter decorator for platform-guarded routes. */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffPayload =>
    ctx.switchToHttp().getRequest().user,);
export type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'MODERATOR';

/** Route-level required platform roles. SUPER_ADMIN always passes. */
export const PlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);

/**
 * Guards routes for Ferio STAFF only.
 *
 * The Bearer token must be a PLATFORM-REALM token issued by
 * `POST /identity/platform/login` (central-user tokens carry no realm
 * and are rejected), and its role must satisfy any @PlatformRoles()
 * metadata on the route. SUPER_ADMIN bypasses role checks.
 */
@Injectable()
export class PlatformAdminGuard extends AuthGuard('identity-jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override handleRequest<TUser = any>(
    err: unknown,
    user: any,
    info: Error | undefined,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        info?.message ?? 'Platform authentication required',
      );
    }
    if (user.realm !== 'platform') {
      throw new ForbiddenException(
        'Platform staff token required — sign in at /identity/platform/login',
      );
    }

    const required = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required?.length && user.role !== 'SUPER_ADMIN' && !required.includes(user.role)) {
      throw new ForbiddenException(
        `Requires one of platform roles: ${required.join(', ')}`,
      );
    }

    return user;
  }
}
