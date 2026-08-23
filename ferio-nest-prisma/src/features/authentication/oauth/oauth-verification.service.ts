import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { StructuredLogger } from '@app/common';

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: true;
};

@Injectable()
export class OAuthVerificationService {
  private readonly logger = new StructuredLogger(OAuthVerificationService.name);
  private readonly googleClient = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        this.logger.warn('authentication_oauth_rejected', {
          provider: 'GOOGLE',
          reason: 'IDENTITY_UNVERIFIED',
        });
        throw new UnauthorizedException(
          'Google account email could not be verified',
        );
      }

      const email = payload.email.trim().toLowerCase();
      return {
        sub: payload.sub,
        email,
        name: payload.name?.trim() || email.split('@')[0],
        picture: payload.picture,
        email_verified: true,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('authentication_oauth_rejected', {
        provider: 'GOOGLE',
        reason: 'TOKEN_INVALID',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new UnauthorizedException('Invalid Google sign-in token');
    }
  }
}
