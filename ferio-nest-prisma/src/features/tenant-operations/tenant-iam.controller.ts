import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { MemberRole, MemberStatus } from '@prisma/tenant-client';
import { TenantIamService } from './tenant-iam.service';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import type { Identity as IdentityType } from '../../infrastructure/identity/identity.decorators';
import { TenantContext } from '../../infrastructure/tenant/tenant-resolver.middleware';

class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}

class AcceptInviteDto {
  @IsString()
  @MinLength(16)
  token!: string;

  /** Ignored — the authenticated identity is bound on acceptance. */
  @IsOptional()
  @IsString()
  centralUserId?: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class UpdateMemberDto {
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @IsOptional()
  scopePropertyIds?: string[];

  @IsOptional()
  scopeBuildingIds?: string[];

  @IsOptional()
  scopeUnitIds?: string[];
}

/**
 * SaaS IAM Controller (§9 — membership & invites)
 * Protected by the §10 central identity guard.
 */
@ApiTags('Tenant IAM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenant/iam')
export class TenantIamController {
  constructor(private readonly iam: TenantIamService) {}

  private ctx(
    req: any,
    identity: IdentityType | null,
  ): { organizationId: string; actorId: string } {
    const context: TenantContext | undefined = req.tenantContext;
    if (!context?.organizationId) {
      throw new BadRequestException('Missing or invalid tenant context');
    }
    if (!identity?.userId) {
      throw new BadRequestException('Missing authenticated identity');
    }
    return { organizationId: context.organizationId, actorId: identity.userId };
  }

  // ── Invites ──

  @Post('invites')
  @ApiOperation({
    summary: 'Invite a staff member (single-use token, 7-day expiry)',
  })
  async createInvite(
    @Req() req: any,
    @Identity() identity: IdentityType | null,
    @Body() dto: CreateInviteDto,
  ) {
    const { organizationId, actorId } = this.ctx(req, identity);
    return this.iam.createInvite(organizationId, actorId, dto);
  }

  @Get('invites')
  @ApiOperation({ summary: 'List membership invites' })
  async listInvites(
    @Req() req: any,
    @Identity() identity: IdentityType | null,
  ) {
    const { organizationId, actorId } = this.ctx(req, identity);
    return this.iam.listInvites(organizationId, actorId);
  }

  @Patch('invites/:inviteId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invite' })
  async revokeInvite(
    @Req() req: any,
    @Identity() identity: IdentityType | null,
    @Param('inviteId') inviteId: string,
  ) {
    const { organizationId, actorId } = this.ctx(req, identity);
    return this.iam.revokeInvite(organizationId, actorId, inviteId);
  }

  @Post('invites/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an invite with its token and bind a central identity',
  })
  async acceptInvite(
    @Req() req: any,
    @Identity() identity: IdentityType | null,
    @Body() dto: AcceptInviteDto,
  ) {
    const context: TenantContext | undefined = req.tenantContext;
    if (!context?.organizationId || !identity?.userId) {
      throw new BadRequestException('Missing or invalid tenant context');
    }
    // The accepting user is the AUTHENTICATED central identity.
    return this.iam.acceptInvite(context.organizationId, {
      token: dto.token,
      centralUserId: identity.userId,
      displayName: dto.displayName,
      phone: dto.phone,
    });
  }

  // ── Members ──

  @Get('members')
  @ApiOperation({ summary: 'List workspace members with roles and scopes' })
  async listMembers(
    @Req() req: any,
    @Identity() identity: IdentityType | null,
  ) {
    const { organizationId } = this.ctx(req, identity);
    return this.iam.listMembers(organizationId);
  }

  @Patch('members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update member role, status, or resource scopes' })
  async updateMember(
    @Req() req: any,
    @Identity() identity: IdentityType | null,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const { organizationId, actorId } = this.ctx(req, identity);
    return this.iam.updateMember(organizationId, actorId, memberId, dto);
  }
}
