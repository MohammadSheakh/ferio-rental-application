import {
  Body,
  ConflictException,
  Controller,
  BadRequestException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IdentityService } from './identity.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard';
import { Identity } from './identity.decorators';
import type { Identity as IdentityType } from './identity.decorators';
import { PlatformAdminGuard } from './platform-admin.guard';
import { CurrentStaff } from './platform-admin.guard';
import type { StaffPayload } from './platform-admin.guard';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { PlatformBillingService } from '../billing/platform-billing.service';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

class TotpCodeDto {
  @IsString()
  code!: string;
}

class GoogleLoginDto {
  /** ID token from Google Identity Services (frontend button). */
  @IsString()
  credential!: string;
}

class CreateMyOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  /** Desired subdomain. Defaults to a slug derived from `name`. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, {
    message: 'slug must be 3–40 chars: lowercase letters, digits, dashes',
  })
  slug?: string;

  @IsOptional()
  @IsIn(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'])
  planTier?: string;
}

/**
 * Central Identity endpoints (§10).
 * Mounted at /identity — one login across marketplace + SaaS surfaces.
 * (Legacy commerce routes remain under /auth until retirement.)
 */
@ApiTags('Identity')
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly provisioning: ProvisioningService,
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly platformBilling: PlatformBillingService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a central account (email + password)' })
  async register(@Body() dto: RegisterDto) {
    return this.identity.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email + password login' })
  async login(@Body() dto: LoginDto) {
    return this.identity.login(dto.email, dto.password);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Google Sign-In — verify a Google Identity Services ID token',
  })
  async google(@Body() dto: GoogleLoginDto) {
    return this.identity.googleLogin(dto.credential);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token → new access+refresh pair (single-use)' })
  async refresh(@Body() dto: RefreshDto) {
    return this.identity.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the presented refresh token' })
  async logout(@Body() dto: RefreshDto) {
    await this.identity.logout(dto.refreshToken);
    return { success: true };
  }

  @Get('my/organizations')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Organizations where the authenticated identity holds an ACTIVE membership',
  })
  async myOrganizations(@Identity() identity: IdentityType | null) {
    return this.identity.listMyOrganizations(identity!.userId);
  }

  /**
   * Self-serve subscribe → provision (§ Week 8 gap).
   * The signed-in advertiser becomes an ORGANIZATION_OWNER of a freshly
   * provisioned workspace (dedicated tenant DB, seeded subscription,
   * primary subdomain). Payment collection is Week-27 scope — the
   * subscription starts ACTIVE on the chosen tier.
   */
  @Post('my/organizations')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Self-serve: create + provision MY organization on a paid tier (I become its owner)',
  })
  async createMyOrganization(
    @Identity() identity: IdentityType | null,
    @Body() dto: CreateMyOrganizationDto,
  ) {
    if (!identity?.userId) throw new BadRequestException('Missing authenticated identity');
    const me = await this.identity.getMe(identity.userId);

    const derived = `${me.displayName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const slug = dto.slug ?? (derived || `org-${Date.now().toString(36)}`);

    try {
      const result = await this.provisioning.provisionOrganization({
        name: dto.name,
        slug,
        ownerUserId: me.userId,
        ownerName: me.displayName,
        ownerEmail: me.email,
        planTier: dto.planTier ?? 'STARTER',
      });
      if (result.status === 'FAILED') {
        throw new ConflictException(result.error ?? 'Provisioning failed — retryable');
      }
      if (result.status === 'ALREADY_PROVISIONED') {
        // Idempotent re-entry is only valid for the org's OWN owner —
        // otherwise the taken slug must 409 without leaking details.
        const existing = await this.controlPlane.saasOrganization.findUnique({
          where: { slug },
          select: { ownerUserId: true },
        });
        if (existing?.ownerUserId !== me.userId) {
          throw new ConflictException('That subdomain is taken — choose another slug');
        }
      }
      // § Week 27: first subscription invoice for the new workspace.
      const sub = await this.controlPlane.subscription.findUnique({
        where: { organizationId: result.organizationId },
        select: { id: true },
      });
      const invoice = sub
        ? await this.platformBilling.ensurePeriodInvoice(sub.id).catch(() => null)
        : null;
      return { ...result, firstInvoice: invoice };
    } catch (err) {
      // Surface slug collisions as an explicit 409 the UI can act on.
      if (
        err instanceof ConflictException &&
        /already/i.test(String((err as any).response ?? ''))
      ) {
        throw new ConflictException('That subdomain is taken — choose another slug');
      }
      if (
        err instanceof Error &&
        /Unique constraint.*SaasOrganization.*slug|slug.*Unique/i.test(err.message)
      ) {
        throw new ConflictException('That subdomain is taken — choose another slug');
      }
      throw err;
    }
  }

  // ── Platform-admin realm (Ferio staff only) ──

  @Post('platform/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PlatformUser staff login — issues a platform-realm token (12h)' })
  async platformLogin(@Body() dto: PlatformLoginDto) {
    return this.identity.platformLogin(dto.email, dto.password, dto.code);
  }

  // ── Staff TOTP management (platform token required) ──

  @Get('platform/totp/status')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Whether the current staff account has TOTP enforced' })
  async totpStatus(@CurrentStaff() staff: StaffPayload) {
    return this.identity.platformTotpStatus(staff.userId);
  }

  @Post('platform/totp/setup')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin TOTP enrollment — returns base32 secret + otpauth URI' })
  async totpSetup(@Identity() identity: IdentityType | null) {
    return this.identity.platformTotpSetup(identity!.userId);
  }

  @Post('platform/totp/confirm')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a valid code → TOTP enforced at next login' })
  async totpConfirm(@Identity() identity: IdentityType | null, @Body() dto: TotpCodeDto) {
    return this.identity.platformTotpConfirm(identity!.userId, dto.code);
  }

  @Post('platform/totp/disable')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable an existing TOTP enrollment (current code required)' })
  async totpDisable(@Identity() identity: IdentityType | null, @Body() dto: TotpCodeDto) {
    return this.identity.platformTotpDisable(identity!.userId, dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current central identity' })
  async me(@Identity() identity: IdentityType | null) {
    return this.identity.getMe(identity!.userId);
  }
}
