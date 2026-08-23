import { Prisma, ItemStatus } from '@app/database/prisma/generated/client';
import { UnitType } from '@app/common';

export const bakeryItems = [
  { name: 'Bakery Bread', description: 'Freshly baked sourdough', price: new Prisma.Decimal(3.0), inventory: new Prisma.Decimal(30), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Bakery' },
  { name: 'Bakery Croissant', description: 'Buttery flaky croissants', price: new Prisma.Decimal(2.0), inventory: new Prisma.Decimal(40), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Bakery' },
  { name: 'Bakery Muffin', description: 'Blueberry breakfast muffins', price: new Prisma.Decimal(1.5), inventory: new Prisma.Decimal(50), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Bakery' },
  { name: 'Bakery Bagel', description: 'Sesame seed bagels', price: new Prisma.Decimal(1.0), inventory: new Prisma.Decimal(60), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Bakery' },
  { name: 'Bakery Cake', description: 'Chocolate sponge cake', price: new Prisma.Decimal(12.0), inventory: new Prisma.Decimal(10), unit: UnitType.PCS, status: ItemStatus.PUBLISHED, isAvailable: true, category: 'Bakery' },
];
