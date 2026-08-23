import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

export interface RentalOrgContext {
  organizationId: string;
  userId: string;
  role?: string;
  permissions: string[];
}

export const OrgContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RentalOrgContext => {
    const request = ctx.switchToHttp().getRequest();
    const orgId = request.headers['x-organization-id'] || request.query?.organizationId || request.body?.organizationId;

    if (!orgId) {
      throw new ForbiddenException('Missing Organization Context. Header x-organization-id or organizationId query parameter required.');
    }

    return {
      organizationId: orgId,
      userId: request.user?.id || request.user?.sub,
      role: request.user?.role,
      permissions: request.user?.permissions || [],
    };
  },
);
