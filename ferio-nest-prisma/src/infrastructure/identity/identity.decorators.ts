import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JWT payload attached by JwtStrategy: {sub, email}. */
export interface AuthPayload {
  sub: string;
  email: string;
}

/** Resolved central identity for the current request. */
export interface Identity {
  userId: string;
  email: string;
}

/**
 * `@Identity()` parameter decorator — the authenticated central user.
 * Normalizes the passport payload ({sub,email}) into {userId,email}.
 */
export const Identity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Identity | null => {
    const user = ctx.switchToHttp().getRequest().user;
    const userId = user?.sub ?? user?.userId;
    if (!userId) return null;
    return { userId, email: user.email };
  },
);

/** Raw passport payload alias. */
export const AuthPayload = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload | null =>
    ctx.switchToHttp().getRequest().user ?? null,
);
