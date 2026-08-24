import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExternalRequest } from './api-key.guard';

export const API_SCOPE_KEY = 'external_api_scope';
export const RequireApiScope = (scope: string) => SetMetadata(API_SCOPE_KEY, scope);

/**
 * Runs after ApiKeyGuard: rejects the request when the resolved key
 * lacks the scope declared on the route via @RequireApiScope().
 */
@Injectable()
export class ApiScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<string>(
      API_SCOPE_KEY,
      ctx.getHandler(),
    );
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<ExternalRequest>();
    if (!req.apiKey?.scopes.includes(required)) {
      throw new ForbiddenException(`API key lacks required scope "${required}"`);
    }
    return true;
  }
}
