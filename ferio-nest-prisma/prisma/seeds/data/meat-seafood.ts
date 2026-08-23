import { Prisma, ItemStatus } from '@app/database/prisma/generated/client';
import { UnitType } from '@app/common';

export const meatSeafoodItems = [
  { name: 'Meat Chicken', description: 'Fresh chicken breast', price: new Prisma.Decimal(8.5), inventory: new Prisma.Decimal(40), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Meat & Seafood' },
  { name: 'Meat Beef', description: 'Lean ground beef', price: new Prisma.Decimal(12.0), inventory: new Prisma.Decimal(30), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Meat & Seafood' },
  { name: 'Meat Salmon', description: 'Fresh Atlantic salmon fillet', price: new Prisma.Decimal(22.0), inventory: new Prisma.Decimal(20), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Meat & Seafood' },
  { name: 'Meat Prawns', description: 'Large peeled prawns', price: new Prisma.Decimal(15.0), inventory: new Prisma.Decimal(25), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Meat & Seafood' },
  { name: 'Meat Lamb', description: 'Tender lamb chops', price: new Prisma.Decimal(18.0), inventory: new Prisma.Decimal(15), unit: UnitType.KG, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Meat & Seafood' },
];
