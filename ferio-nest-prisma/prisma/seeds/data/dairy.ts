import { Prisma, ItemStatus } from '@app/database/prisma/generated/client';
import { UnitType } from '@app/common';

export const dairyItems = [
  { name: 'Dairy Milk', description: 'Fresh whole milk', price: new Prisma.Decimal(2.5), inventory: new Prisma.Decimal(100), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Dairy' },
  { name: 'Dairy Cheese', description: 'Cheddar cheese block', price: new Prisma.Decimal(4.5), inventory: new Prisma.Decimal(40), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Dairy' },
  { name: 'Dairy Yogurt', description: 'Plain Greek yogurt', price: new Prisma.Decimal(1.5), inventory: new Prisma.Decimal(80), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Dairy' },
  { name: 'Dairy Butter', description: 'Unsalted creamery butter', price: new Prisma.Decimal(3.5), inventory: new Prisma.Decimal(60), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Dairy' },
  { name: 'Dairy Cream', description: 'Heavy whipping cream', price: new Prisma.Decimal(2.0), inventory: new Prisma.Decimal(40), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Dairy' },
];
