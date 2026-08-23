import { PrismaClient } from '@app/database/prisma/generated/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('Seeding users...');

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });

  if (!adminRole || !userRole) {
    throw new Error('Roles must be seeded before users.');
  }

  const adminPassword = await bcrypt.hash('adminPass123', 10);
  const userPassword = await bcrypt.hash('userPass123', 10);

  const users = [
    {
      email: 'livealvi@gmail.com',
      firstName: 'Alvi',
      lastName: 'Hasan',
      password: adminPassword,
      roleId: adminRole.id,
    },
    {
      email: 'salman@example.com',
      firstName: 'Salman',
      lastName: 'Karim',
      password: userPassword,
      roleId: userRole.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  console.log('✅ Users seeded.');
}
