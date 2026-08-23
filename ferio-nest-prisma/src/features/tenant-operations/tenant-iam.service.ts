import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MemberRole, MemberStatus } from '@prisma/tenant-client';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { EntitlementService } from '../../infrastructure/entitlements/entitlement.service';

const INVITE_TTL_DAYS = 7;

/** Roles that may manage members (§9 SaaS IAM). */
const MEMBER_ADMIN_ROLES: MemberRole[] = [
  MemberRole.ORGANIZATION_OWNER,
  MemberRole.PROPERTY_MANAGER,
];

/**
 * SaaS IAM Service
 *
 * Membership & invitation lifecycle for a tenant workspace:
 *   invite → (email delivers token) → accept → ACTIVE member
 *
 * Invites are single-use, expiring, revocable, and unique per email.
 * Staff creation is quota-gated by the plan's maxStaff entitlement.
 */
@Injectable()
export class TenantIamService {
  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly entitlements: EntitlementService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Invites
  // ────────────────────────────────────────────────────────────

  async createInvite(
    organizationId: string,
    actorId: string,
    input: { email: string; role: MemberRole },
  ) {
    await this.assertMemberAdmin(organizationId, actorId);

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const email = input.email.toLowerCase().trim();

    const existingMember = await db.member.findFirst({ where: { email } });
    if (existingMember && existingMember.status !== MemberStatus.DISABLED) {
      throw new ConflictException('A member with this email already exists');
    }

    const existingInvite = await db.memberInvite.findUnique({
      where: { email },
    });
    if (
      existingInvite &&
      !existingInvite.revokedAt &&
      existingInvite.expiresAt > new Date()
    ) {
      throw new ConflictException(
        'An active invite for this email already exists',
      );
    }

    // Staff seats are plan-limited (guard compares current count to cap).
    const activeStaff = await db.member.count({
      where: { status: MemberStatus.ACTIVE },
    });
    await this.entitlements.checkQuota(organizationId, 'staff', activeStaff);

    if (input.role === MemberRole.ORGANIZATION_OWNER) {
      throw new BadRequestException(
        'Ownership transfer is not done via invites',
      );
    }

    const token = randomBytes(32).toString('hex');

    // Upsert keeps one live invite row per email (unique constraint).
    const invite = existingInvite
      ? await db.memberInvite.update({
          where: { id: existingInvite.id },
          data: {
            role: input.role,
            token,
            revokedAt: null,
            acceptedAt: null,
            invitedBy: actorId,
            expiresAt: this.expiry(),
          },
        })
      : await db.memberInvite.create({
          data: {
            email,
            role: input.role,
            token,
            invitedBy: actorId,
            expiresAt: this.expiry(),
          },
        });

    return { ...invite, token };
  }

  async listInvites(organizationId: string, actorId: string) {
    await this.assertMemberAdmin(organizationId, actorId);
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.memberInvite.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeInvite(
    organizationId: string,
    actorId: string,
    inviteId: string,
  ) {
    await this.assertMemberAdmin(organizationId, actorId);
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.memberInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Accept an invite: binds the accepting central identity to the
   * workspace and activates their membership.
   */
  async acceptInvite(
    organizationId: string,
    input: {
      token: string;
      centralUserId: string;
      displayName: string;
      phone?: string;
    },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const invite = await db.memberInvite.findUnique({
      where: { token: input.token },
    });
    if (!invite) throw new NotFoundException('Invalid invite token');
    if (invite.revokedAt)
      throw new ForbiddenException('This invite was revoked');
    if (invite.acceptedAt) throw new ConflictException('Invite already used');
    if (invite.expiresAt < new Date())
      throw new ForbiddenException('Invite has expired');

    const existing = await db.member.findUnique({
      where: { centralUserId: input.centralUserId },
    });
    if (existing) {
      if (existing.status === MemberStatus.ACTIVE) {
        throw new ConflictException('Already a member of this organization');
      }
      await db.member.update({
        where: { id: existing.id },
        data: { status: MemberStatus.ACTIVE, acceptedAt: new Date() },
      });
    } else {
      await db.member.create({
        data: {
          centralUserId: input.centralUserId,
          role: invite.role,
          status: MemberStatus.ACTIVE,
          displayName: input.displayName,
          email: invite.email,
          phone: input.phone,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        },
      });
    }

    // Single-use: burn the token immediately after membership is active.
    await db.memberInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        token: `used:${randomBytes(16).toString('hex')}`,
      },
    });

    await this.audit(
      db,
      input.centralUserId,
      'member.invite_accepted',
      'MemberInvite',
      invite.id,
      {
        role: invite.role,
      },
    );

    return { accepted: true, role: invite.role };
  }

  // ────────────────────────────────────────────────────────────
  // Members
  // ────────────────────────────────────────────────────────────

  async listMembers(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.member.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        centralUserId: true,
        role: true,
        status: true,
        displayName: true,
        email: true,
        phone: true,
        scopePropertyIds: true,
        scopeBuildingIds: true,
        scopeUnitIds: true,
        acceptedAt: true,
      },
    });
  }

  async updateMember(
    organizationId: string,
    actorId: string,
    memberId: string,
    changes: {
      role?: MemberRole;
      status?: MemberStatus;
      scopePropertyIds?: string[];
      scopeBuildingIds?: string[];
      scopeUnitIds?: string[];
    },
  ) {
    await this.assertMemberAdmin(organizationId, actorId);
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    if (changes.role === MemberRole.ORGANIZATION_OWNER) {
      throw new BadRequestException(
        'Use ownership transfer to assign ORGANIZATION_OWNER',
      );
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await db.member.update({
      where: { id: memberId },
      data: changes,
    });

    await this.audit(db, actorId, 'member.updated', 'Member', memberId, {
      changes,
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────

  private async audit(
    db: Awaited<ReturnType<TenantDatabaseManager['getTenantDatabase']>>,
    actorId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await db.tenantAuditEvent
      .create({
        data: { actorId, action, resourceType, resourceId, metadata: metadata as any },
      })
      .catch(() => {});
  }

  /** Guard: actor must hold a member-admin role and be ACTIVE. */
  private async assertMemberAdmin(
    organizationId: string,
    actorCentralUserId: string,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const actor = await db.member.findUnique({
      where: { centralUserId: actorCentralUserId },
    });
    if (!actor || actor.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException(
        'You are not an active member of this organization',
      );
    }
    if (!MEMBER_ADMIN_ROLES.includes(actor.role)) {
      throw new ForbiddenException(`${actor.role} cannot manage members`);
    }
  }

  private expiry(): Date {
    return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  }
}
