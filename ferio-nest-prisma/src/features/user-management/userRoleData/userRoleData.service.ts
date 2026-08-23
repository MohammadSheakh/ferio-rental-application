import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GenericService } from '@app/common';
import { PrismaService } from '@app/database';

const publicUserRoleDataSelect = {
  id: true,
  userId: true,
  adminStatus: true,
  providerApprovalStatus: true,
  approvedAt: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserRoleDataSelect;

type UserRoleDataRecord = Prisma.UserRoleDataGetPayload<{
  select: typeof publicUserRoleDataSelect;
}>;

@Injectable()
export class UserRoleDataService extends GenericService<Prisma.UserRoleDataDelegate, UserRoleDataRecord> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.userRoleData, publicUserRoleDataSelect);
  }

  paginate(query: any) {
    return this.findAllWithPagination({}, query);
  }

  softDelete(id: string) {
    return this.updateById(id, { isDeleted: true });
  }
}
