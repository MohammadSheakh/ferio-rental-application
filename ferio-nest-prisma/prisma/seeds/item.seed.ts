import { PrismaClient } from '@app/database/prisma/generated/client';
import { fruitItems } from './data/fruits';
import { vegetableItems } from './data/vegetables';
import { dairyItems } from './data/dairy';
import { bakeryItems } from './data/bakery';
import { meatSeafoodItems } from './data/meat-seafood';

export async function seedItems(prisma: PrismaClient) {
  console.log('Seeding items...');

  const categories = await prisma.category.findMany();
  
  const getCategoryId = (name: string) => categories.find(c => c.name === name)?.id;

  const allItems = [
    ...fruitItems,
    ...vegetableItems,
    ...dairyItems,
    ...bakeryItems,
    ...meatSeafoodItems,
  ];

  for (const item of allItems) {
    const categoryId = getCategoryId(item.category);
    if (!categoryId) {
      console.warn(`Category "${item.category}" not found for item "${item.name}". Skipping.`);
      continue;
    }

    // Prepare data without the helper 'category' property
    const { category, ...itemData } = item;

    const existing = await prisma.item.findFirst({
      where: { name: item.name, categoryId }
    });

    if (!existing) {
      await prisma.item.create({
        data: { ...itemData, categoryId },
      });
    } else {
      await prisma.item.update({
        where: { id: existing.id },
        data: { ...itemData, categoryId },
      });
    }
  }

  console.log('✅ Items seeded.');
}
