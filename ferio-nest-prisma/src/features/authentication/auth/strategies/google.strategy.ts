import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * Google OAuth Strategy
 * 
 * 📚 EXPRESS → NESTJS TRANSITION
 * 
 * Express Pattern:
 * - Manual passport.use() configuration
 * - Separate passport config file
 * - Manual callback handling
 * 
 * NestJS Pattern:
 * - PassportStrategy class
 * - Decorator-based configuration
 * - Automatic callback handling
 * 
 * Key Benefits:
 * ✅ Clean configuration
 * ✅ Easy to test
 * ✅ Reusable across modules
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  /**
   * Validate Google OAuth response
   * Called automatically after successful Google authentication
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, name, photos } = profile;

    const user = {
      providerId: id,
      email: emails?.[0]?.value,
      name: `${name?.givenName} ${name?.familyName}`,
      profileImage: photos?.[0]?.value,
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}
