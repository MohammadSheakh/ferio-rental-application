import { PrismaClient } from '@app/database/prisma/generated/client';

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding categories...');

  const categories = [
    { name: 'Fruits' },
    { name: 'Vegetables' },
    { name: 'Dairy' },
    { name: 'Bakery' },
    { name: 'Meat & Seafood' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  console.log('✅ Categories seeded.');
}
