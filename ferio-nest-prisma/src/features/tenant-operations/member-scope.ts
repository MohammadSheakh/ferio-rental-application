import { ForbiddenException } from '@nestjs/common';
import { Member, MemberRole } from '@prisma/tenant-client';

/**
 * Per-resource scope ACLs (§ Week 9 — property/building/unit scope).
 *
 * Semantics:
 * - Workspace-wide roles (ORGANIZATION_OWNER, PROPERTY_MANAGER) always
 *   see everything.
 * - For every other role: if ALL scope arrays are empty the member is
 *   unscoped (legacy behaviour — role gates still apply); if ANY array
 *   is non-empty the member is restricted to the UNION of listed
 *   resources.
 */

const WORKSPACE_WIDE_ROLES: MemberRole[] = [
  MemberRole.ORGANIZATION_OWNER,
  MemberRole.PROPERTY_MANAGER,
];

export function isWorkspaceWide(member: Pick<Member, 'role'>): boolean {
  return WORKSPACE_WIDE_ROLES.includes(member.role);
}

export function isScoped(member: Pick<Member, 'role' | 'scopePropertyIds' | 'scopeBuildingIds' | 'scopeUnitIds'>): boolean {
  if (isWorkspaceWide(member)) return false;
  return (
    member.scopePropertyIds.length > 0 ||
    member.scopeBuildingIds.length > 0 ||
    member.scopeUnitIds.length > 0
  );
}

interface ScopeTarget {
  id: string;
  propertyId?: string | null;
  buildingId?: string | null;
}

/** Does this member's scope grant access to the resource? */
export function inScope(
  member: Pick<Member, 'role' | 'scopePropertyIds' | 'scopeBuildingIds' | 'scopeUnitIds'>,
  target: ScopeTarget,
): boolean {
  if (!isScoped(member)) return true;
  if (member.scopePropertyIds.includes(target.id)) return true;
  if (member.scopeUnitIds.includes(target.id)) return true;
  if (target.buildingId && member.scopeBuildingIds.includes(target.buildingId)) return true;
  if (target.propertyId && member.scopePropertyIds.includes(target.propertyId)) return true;
  return false;
}

export function filterByScope<T extends ScopeTarget>(
  member: Parameters<typeof inScope>[0],
  items: T[],
): T[] {
  if (!isScoped(member)) return items;
  return items.filter((i) => inScope(member, i));
}

/** First-match assertion for single-resource endpoints. */
export function assertInScope(
  member: Parameters<typeof inScope>[0],
  target: ScopeTarget,
  label = 'resource',
): void {
  if (!inScope(member, target)) {
    throw new ForbiddenException(
      `Your membership scope does not include this ${label}`,
    );
  }
}
