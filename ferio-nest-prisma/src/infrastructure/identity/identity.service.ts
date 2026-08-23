import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'crypto';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import * as bcrypt from 'bcrypt';
import { CredentialProvider } from '@prisma/control-client';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';

import {
  ACCESS_TTL,
  GOOGLE_CLIENT_ID,
  JWT_SECRET,
  PLATFORM_ACCESS_TTL,
  REFRESH_TTL_DAYS,
} from './identity.constants';

export interface SessionTokens {
  token: string;
  refreshToken: string;
}

interface PlatformIdentityPayload extends IdentityPayload {
  realm: 'platform';
  role: string;
}

export interface IdentityPayload {
  userId: string;
  email: string;
  displayName: string;
}

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Central Identity Service (§10)
 *
 * One account across marketplace + SaaS, stored in the CONTROL PLANE.
 *
 * - Password accounts: bcrypt hashes (never tenant DBs).
 * - Google accounts: Google Identity Services ID token verified
 *   server-side against GOOGLE_CLIENT_ID; linked by `sub`, and by
 *   email when an existing password account matches (account linking).
 *
 * Issues HS256 access tokens signed with JWT_ACCESS_SECRET.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly jwt: JwtService,
    private readonly tenantDbManager: TenantDatabaseManager,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Registration & login
  // ────────────────────────────────────────────────────────────

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
  }): Promise<SessionTokens & { user: IdentityPayload }> {
    const email = input.email.toLowerCase().trim();

    const existing = await this.controlPlane.centralUser.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    if (input.password.length < 8) {
      throw new ConflictException('Password must be at least 8 characters');
    }

    const user = await this.controlPlane.centralUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: input.displayName,
        phone: input.phone,
        provider: CredentialProvider.PASSWORD,
        emailVerified: false,
      },
    });

    this.logger.log(`👤 Central identity registered: ${email}`);
    return {
      token: this.sign(user.id, user.email),
      refreshToken: await this.issueRefresh(user.id),
      user: this.toPayload(user),
    };
  }

  async login(email: string, password: string): Promise<SessionTokens & { user: IdentityPayload }> {
    const user = await this.controlPlane.centralUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user?.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      token: this.sign(user.id, user.email),
      refreshToken: await this.issueRefresh(user.id),
      user: this.toPayload(user),
    };
  }

  /**
   * Google Sign-In: the client obtains an ID token from Google
   * Identity Services; we verify it server-side and upsert the user.
   */
  async googleLogin(credential: string): Promise<SessionTokens & { user: IdentityPayload }> {
    if (!GOOGLE_CLIENT_ID) {
      throw new UnauthorizedException('Google sign-in is not configured on this server');
    }

    let info: GoogleTokenInfo;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new Error('missing claims');
      }
      info = {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        email_verified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
      };
    } catch {
      throw new UnauthorizedException('Google credential is invalid or expired');
    }

    // Existing Google-linked account?
    let user = await this.controlPlane.centralUser.findUnique({
      where: { googleSub: info.sub },
    });

    // Link by verified email to an existing PASSWORD account.
    if (!user) {
      const byEmail = await this.controlPlane.centralUser.findUnique({
        where: { email: info.email },
      });
      if (byEmail) {
        user = await this.controlPlane.centralUser.update({
          where: { id: byEmail.id },
          data: {
            googleSub: info.sub,
            emailVerified: info.email_verified ?? true,
            avatarUrl: byEmail.avatarUrl ?? info.picture,
          },
        });
      }
    }

    // First-time Google user.
    if (!user) {
      user = await this.controlPlane.centralUser.create({
        data: {
          email: info.email,
          displayName: info.name ?? info.email.split('@')[0],
          avatarUrl: info.picture,
          provider: CredentialProvider.GOOGLE,
          googleSub: info.sub,
          emailVerified: info.email_verified ?? true,
        },
      });
      this.logger.log(`🟢 Google identity created: ${info.email}`);
    }

    return {
      token: this.sign(user.id, user.email),
      refreshToken: await this.issueRefresh(user.id),
      user: this.toPayload(user),
    };
  }

  async getMe(userId: string): Promise<IdentityPayload> {
    const user = await this.controlPlane.centralUser.findUnique({
      where: { id: userId },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return this.toPayload(user);
  }

  // ────────────────────────────────────────────────────────────

  private sign(userId: string, email: string): string {
    return this.jwt.sign({ sub: userId, email }, { expiresIn: ACCESS_TTL });
  }

  // ────────────────────────────────────────────────────────────
  // Refresh-token rotation
  // ────────────────────────────────────────────────────────────

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async issueRefresh(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    await this.controlPlane.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
      },
    });
    return raw;
  }

  /** Rotate: single-use. Reuse of a rotated/revoked token kills the family entry. */
  async refresh(rawRefreshToken: string): Promise<SessionTokens & { user: IdentityPayload }> {
    const record = await this.controlPlane.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawRefreshToken) },
    });

    if (!record) throw new UnauthorizedException('Invalid refresh token');

    if (record.revokedAt || record.rotatedTo) {
      // Possible replay of an already-rotated token — revoke the whole chain root.
      await this.controlPlane.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.controlPlane.centralUser.findUnique({
      where: { id: record.userId },
    });
    if (!user?.isActive) throw new UnauthorizedException();

    const nextRaw = await this.issueRefresh(user.id);
    await this.controlPlane.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return {
      token: this.sign(user.id, user.email),
      refreshToken: nextRaw,
      user: this.toPayload(user),
    };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    await this.controlPlane.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Platform-admin realm (RBAC)
  // ────────────────────────────────────────────────────────────

  /**
   * Ferio staff login against PlatformUser. Accepts bcrypt hashes and,
   * for legacy seed rows only, plaintext equality (auto-upgrades to hash).
   */
  async platformLogin(
    email: string,
    password: string,
    code?: string,
  ): Promise<{ token: string; user: { userId: string; email: string; role: string } }> {
    const staff = await this.controlPlane.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!staff?.isActive) throw new UnauthorizedException('Invalid credentials');

    let ok = false;
    if (staff.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, staff.password);
    } else {
      ok = staff.password === password;
      if (ok) {
        // Upgrade legacy plaintext to a hash.
        await this.controlPlane.platformUser
          .update({
            where: { id: staff.id },
            data: { password: await bcrypt.hash(password, 10) },
          })
          .catch(() => {});
      }
    }
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // RFC-6238 second factor for enrolled staff.
    if (staff.totpEnabled) {
      if (!code || !staff.totpSecret || !verifyTotp(staff.totpSecret, code)) {
        throw new UnauthorizedException('Valid TOTP code required');
      }
    }

    const payload: PlatformIdentityPayload & { sub: string } = {
      sub: staff.id,
      userId: staff.id,
      email: staff.email,
      displayName: staff.name,
      realm: 'platform',
      role: staff.role,
    };
    const token = this.jwt.sign(payload, { expiresIn: PLATFORM_ACCESS_TTL });
    this.logger.log(`🛡️  Platform staff signed in: ${staff.email} (${staff.role})`);
    return { token, user: { userId: staff.id, email: staff.email, role: staff.role } };
  }

  // ────────────────────────────────────────────────────────────
  // Staff TOTP lifecycle (RFC-6238)
  // ────────────────────────────────────────────────────────────

  async platformTotpStatus(platformUserId: string): Promise<{ enabled: boolean }> {
    const staff = await this.controlPlane.platformUser.findUnique({
      where: { id: platformUserId },
      select: { totpEnabled: true },
    });
    if (!staff) throw new UnauthorizedException();
    return { enabled: staff.totpEnabled };
  }

  /** Step 1: provision a pending secret; enrollment completes on first valid code. */
  async platformTotpSetup(
    platformUserId: string,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const staff = await this.controlPlane.platformUser.findUnique({
      where: { id: platformUserId },
    });
    if (!staff?.isActive) throw new UnauthorizedException();

    const secret = generateTotpSecret();
    await this.controlPlane.platformUser.update({
      where: { id: platformUserId },
      data: { totpSecret: secret, totpEnabled: false }, // pending confirmation
    });

    return { secret, otpauthUri: otpauthUri(secret, staff.email) };
  }

  async platformTotpConfirm(platformUserId: string, code: string): Promise<{ enabled: boolean }> {
    const staff = await this.controlPlane.platformUser.findUnique({
      where: { id: platformUserId },
    });
    if (!staff?.totpSecret) throw new ConflictException('Run TOTP setup first');
    if (!verifyTotp(staff.totpSecret, code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.controlPlane.platformUser.update({
      where: { id: platformUserId },
      data: { totpEnabled: true },
    });
    return { enabled: true };
  }

  async platformTotpDisable(platformUserId: string, code: string): Promise<{ enabled: boolean }> {
    const staff = await this.controlPlane.platformUser.findUnique({
      where: { id: platformUserId },
    });
    if (!staff?.totpEnabled) throw new ConflictException('TOTP is not enrolled');
    if (!verifyTotp(staff.totpSecret ?? '', code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.controlPlane.platformUser.update({
      where: { id: platformUserId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { enabled: false };
  }

  /**
   * Organizations where the identity holds an ACTIVE membership.
   * Cross-DB fan-out over active tenant databases (same pattern as cron scans).
   */
  async listMyOrganizations(userId: string): Promise<
    Array<{ organizationId: string; slug: string; name: string; memberRole: string }>
  > {
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true, slug: true, name: true },
    });

    const memberships: Array<{
      organizationId: string;
      slug: string;
      name: string;
      memberRole: string;
    }> = [];

    for (const org of orgs) {
      try {
        const tenantDb = await this.tenantDbManager.getTenantDatabase(org.id);
        const member = await tenantDb.member.findFirst({
          where: { centralUserId: userId, status: 'ACTIVE' },
          select: { role: true },
        });
        if (member) {
          memberships.push({
            organizationId: org.id,
            slug: org.slug,
            name: org.name,
            memberRole: member.role,
          });
        }
      } catch {
        // unreachable tenant DB — skip silently (§ cron-scan pattern)
      }
    }
    return memberships;
  }

  private toPayload(u: {
    id: string;
    email: string;
    displayName: string;
  }): IdentityPayload {
    return { userId: u.id, email: u.email, displayName: u.displayName };
  }
}
