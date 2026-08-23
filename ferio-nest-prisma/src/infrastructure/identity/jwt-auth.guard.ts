import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthPayload, Identity } from './identity.decorators';

export { AuthPayload, Identity };

/** Hard guard — 401 without a valid Bearer token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('identity-jwt') {}

/**
 * Soft guard — decodes the token when present, anonymous otherwise.
 * Used for viewer-aware public endpoints (document visibility).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('identity-jwt') {
  handleRequest(err: unknown, user: unknown) {
    // Never throw — absence of identity is valid here.
    return err ? null : (user as AuthPayload | null);
  }
}
