import { Prisma, ItemStatus } from '@app/database/prisma/generated/client';
import { UnitType } from '@app/common';

export const vegetableItems = [
  { name: 'Veg Potato', description: 'Fresh baking potatoes', price: new Prisma.Decimal(0.5), inventory: new Prisma.Decimal(300), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Vegetables' },
  { name: 'Veg Tomato', description: 'Red vine tomatoes', price: new Prisma.Decimal(1.8), inventory: new Prisma.Decimal(100), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Vegetables' },
  { name: 'Veg Onion', description: 'Quality red onions', price: new Prisma.Decimal(0.7), inventory: new Prisma.Decimal(200), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Vegetables' },
  { name: 'Veg Spinach', description: 'Fresh green spinach leaves', price: new Prisma.Decimal(1.0), inventory: new Prisma.Decimal(50), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Vegetables' },
  { name: 'Veg Carrot', description: 'Sweet organic carrots', price: new Prisma.Decimal(1.2), inventory: new Prisma.Decimal(150), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Vegetables' },
];
