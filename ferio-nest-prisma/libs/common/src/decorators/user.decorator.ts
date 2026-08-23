import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserPayload as UserPayloadType } from '../types/user-payload.type';
/**
 * User Decorator
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Extracts user payload from request object
 * Type-safe access to authenticated user information
 * 
 * Usage:
 * @Get('profile')
 * async getProfile(@User() user: UserPayload) {
 *   // user.userId, user.email, user.role
 * }
 * 
 * With fields selection:
 * @Get('profile')
 * async getProfile(@User('email') email: string) {
 *   // Only extracts email field
 * }
 */

// Single decorator alias so @User() works
export const UserDecorator = createParamDecorator(
  (data: keyof UserPayloadType | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserPayloadType = request.user;

    if (!user) return null;
    if (data) return user[data];
    return user;
  },
);

/* -----------------------

export const UserDecorator = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserPayload = request.user;

    // If no user found, AuthGuard should have thrown an error
    if (!user) {
      return null;
    }

    // Return specific field if requested
    if (data) {
      return user[data];
    }

    // Return entire user payload
    return user;
  },
);
-----------------------*/
