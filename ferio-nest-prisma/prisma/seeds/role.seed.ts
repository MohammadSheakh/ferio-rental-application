import { PrismaClient } from '@app/database/prisma/generated/client';

export async function seedRoles(prisma: PrismaClient) {
  console.log('Seeding roles...');

  const roles = [
    { name: 'ADMIN' },
    { name: 'USER' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('✅ Roles seeded.');
}
