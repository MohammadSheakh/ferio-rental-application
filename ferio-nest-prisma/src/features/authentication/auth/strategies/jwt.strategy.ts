import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT Strategy
 * 
 * 📚 EXPRESS → NESTJS TRANSITION
 * 
 * Express Pattern:
 * - Manual JWT verification in middleware
 * - req.user = decoded token
 * - Manual token extraction from headers
 * 
 * NestJS Pattern:
 * - PassportStrategy class
 * - Automatic token extraction
 * - @UseGuards(JwtAuthGuard) decorator
 * - @User() decorator to get user info
 * 
 * Key Benefits:
 * ✅ Reusable across controllers
 * ✅ Automatic token validation
 * ✅ Clean controller code
 * ✅ Easy to test
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  /**
   * Validate JWT token
   * Called automatically by Passport after token verification
   */
  async validate(payload: any) {
    if (!payload.userId || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user info that will be attached to request as req.user
    // Can be accessed in controllers via @User() decorator
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  }
}
