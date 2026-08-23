import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';

/**
 * Apple OAuth Strategy
 * 
 * Similar to Google strategy but for Apple Sign-In
 */
@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor() {
    super({
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
      callbackURL: process.env.APPLE_CALLBACK_URL,
      scope: ['email', 'name'],
    });
  }

  /**
   * Validate Apple OAuth response
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { sub: providerId, email } = idToken;

    const user = {
      providerId,
      email,
      name: profile?.name ? `${profile.name.firstName} ${profile.name.lastName}` : null,
      idToken,
    };

    done(null, user);
  }
}
