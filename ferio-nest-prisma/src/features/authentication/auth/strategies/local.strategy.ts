import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Local Strategy (Email/Password)
 * 
 * 📚 EXPRESS → NESTJS TRANSITION
 * 
 * Express Pattern:
 * - Manual email/password comparison in controller
 * - Direct AuthService.login() call
 * - No standardized auth pattern
 * 
 * NestJS Pattern:
 * - Passport Local Strategy
 * - Standardized authentication pattern
 * - @UseGuards(LocalAuthGuard) decorator
 * - Automatic req.user population
 * 
 * Key Benefits:
 * ✅ Standard pattern (passport)
 * ✅ Reusable across endpoints
 * ✅ Easy to extend (add MFA, etc.)
 * ✅ Clean separation of concerns
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    // Use 'email' field instead of default 'username'
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  /**
   * Validate local credentials
   * Called automatically by Passport
   */
  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUserForLocalAuth(email, password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
