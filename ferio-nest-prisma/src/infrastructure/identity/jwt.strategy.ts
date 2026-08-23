import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from './identity.constants';

/**
 * Bearer-token strategy for the central identity (§10).
 * Tokens are HS256, signed with JWT_ACCESS_SECRET, payload {sub,email}.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'identity-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  /**
   * Pass the full signed payload through (sub, email, and optionally
   * realm/role for platform-realm tokens). Guards decide what matters.
   */
  validate(payload: Record<string, unknown>): Record<string, unknown> & { sub: string } {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload as Record<string, unknown> & { sub: string };
  }
}
