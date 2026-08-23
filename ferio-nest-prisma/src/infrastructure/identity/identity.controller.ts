import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IdentityService } from './identity.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard';
import { Identity } from './identity.decorators';
import type { Identity as IdentityType } from './identity.decorators';
import { PlatformAdminGuard } from './platform-admin.guard';
import { CurrentStaff, StaffPayload } from './platform-admin.guard';

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

/**
 * Central Identity endpoints (§10).
 * Mounted at /identity — one login across marketplace + SaaS surfaces.
 * (Legacy commerce routes remain under /auth until retirement.)
 */
@ApiTags('Identity')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

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
  async myOrganizations(@Identity() identity: Identity | null) {
    return this.identity.listMyOrganizations(identity!.userId);
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
  async me(@Identity() identity: Identity | null) {
    return this.identity.getMe(identity!.userId);
  }
}
