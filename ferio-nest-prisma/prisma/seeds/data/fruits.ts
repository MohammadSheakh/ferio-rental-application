import { Prisma, ItemStatus } from '@app/database/prisma/generated/client';
import { UnitType } from '@app/common';

export const fruitItems = [
  { name: 'Fruit Apple', description: 'Fresh and crunchy red apples', price: new Prisma.Decimal(1.5), inventory: new Prisma.Decimal(100), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Fruits' },
  { name: 'Fruit Banana', description: 'Sweet ripe bananas', price: new Prisma.Decimal(0.8), inventory: new Prisma.Decimal(150), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Fruits' },
  { name: 'Fruit Orange', description: 'Juicy citrus oranges', price: new Prisma.Decimal(1.2), inventory: new Prisma.Decimal(120), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Fruits' },
  { name: 'Fruit Grapes', description: 'Fresh green grapes', price: new Prisma.Decimal(2.5), inventory: new Prisma.Decimal(80), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Fruits' },
  { name: 'Fruit Mango', description: 'Tropical sweet mangoes', price: new Prisma.Decimal(3.0), inventory: new Prisma.Decimal(60), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Fruits' },
];
