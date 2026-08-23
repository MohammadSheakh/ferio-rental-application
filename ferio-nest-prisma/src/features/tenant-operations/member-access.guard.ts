import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Member, MemberRole } from '@prisma/tenant-client';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

export const MEMBER_DOMAIN_KEY = 'member_domain';

/** Which roles may WRITE within each operational domain. */
const DOMAIN_WRITE_ROLES: Record<string, MemberRole[]> = {
  inventory: [
    MemberRole.ORGANIZATION_OWNER,
    MemberRole.PROPERTY_MANAGER,
    MemberRole.BUILDING_MANAGER,
  ],
  billing: [MemberRole.ORGANIZATION_OWNER, MemberRole.PROPERTY_MANAGER, MemberRole.ACCOUNTANT],
  leasing: [MemberRole.ORGANIZATION_OWNER, MemberRole.PROPERTY_MANAGER, MemberRole.LEASING_OFFICER],
  maintenance: [
    MemberRole.ORGANIZATION_OWNER,
    MemberRole.PROPERTY_MANAGER,
    MemberRole.MAINTENANCE_MANAGER,
    MemberRole.CARETAKER,
  ],
};

/**
 * Route-level write-domain requirement. Read access is granted to any
 * ACTIVE member; writes additionally require the mapped role set.
 */
export const RequireMemberDomain = (domain: keyof typeof DOMAIN_WRITE_ROLES | 'none') =>
  SetMetadata(MEMBER_DOMAIN_KEY, domain);

/**
 * Runs AFTER JwtAuthGuard: resolves the caller's ACTIVE membership in
 * the resolved organization and enforces domain-level write roles.
 * Attaches `req.member` for handlers.
 */
/**
 * Route-level write-domain check. Requires ActiveMemberGuard to have
 * run first (class-level) so req.member is populated.
 */
@Injectable()
export class DomainWriteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const member: Member | undefined = req.member;
    if (!member) {
      throw new UnauthorizedException('Membership not resolved');
    }

    const domain = this.reflector.getAllAndOverride<string | undefined>(
      MEMBER_DOMAIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!domain || domain === 'none') return true;

    // GETs are member-readable; writes enforce the domain roles.
    if (req.method.toUpperCase() !== 'GET') {
      const allowed = DOMAIN_WRITE_ROLES[domain];
      if (!allowed?.includes(member.role)) {
        throw new ForbiddenException(
          `${member.role.replaceAll('_', ' ').toLowerCase()} cannot perform ${domain} actions`,
        );
      }
    }
    return true;
  }
}

@Injectable()
export class ActiveMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantDbManager: TenantDatabaseManager,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!req.user?.sub) {
      throw new UnauthorizedException('Sign-in required');
    }
    const organizationId = req.tenantContext?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const member: Member | null = await db.member.findFirst({
      where: { centralUserId: req.user.sub },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this organization');
    }
    req.member = member;

    // Reads: any ACTIVE member. Writes: domain role check.
    const method = req.method.toUpperCase();
    if (method !== 'GET') {
      const domain = this.reflector.getAllAndOverride<string | undefined>(
        MEMBER_DOMAIN_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (domain && domain !== 'none') {
        const allowed = DOMAIN_WRITE_ROLES[domain];
        if (!allowed?.includes(member.role)) {
          throw new ForbiddenException(
            `${member.role.replaceAll('_', ' ').toLowerCase()} cannot perform ${domain} actions`,
          );
        }
      }
    }
    return true;
  }
}
