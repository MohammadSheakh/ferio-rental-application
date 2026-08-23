/**
 * Create or update a PlatformUser (Ferio staff) with a bcrypt hash.
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/scripts/create-platform-admin.ts \
 *     admin@ferio.test 'S3curePass!' 'Ferio Root Admin' SUPER_ADMIN
 */
import { PrismaClient as ControlClient } from '@prisma/control-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const [email, password, name, roleArg] = process.argv.slice(2);
  if (!email || !password || !name) {
    console.error('Usage: create-platform-admin.ts <email> <password> <name> [role]');
    process.exit(1);
  }
  const role = roleArg ?? 'SUPER_ADMIN';

  const db = new ControlClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString:
          process.env.CONTROL_PLANE_DATABASE_URL ??
          'postgresql://postgres:testpass@localhost:5498/ferio_control',
      }),
    ),
  } as any);

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const staff = await db.platformUser.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), name, password: passwordHash, role: role as any },
      update: { name, password: passwordHash, role: role as any, isActive: true },
    });
    console.log(`✅ Platform staff ready: ${staff.email} (${staff.role})`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
