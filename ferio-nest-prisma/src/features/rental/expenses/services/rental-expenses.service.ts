import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateExpenseDto, ApproveExpenseDto, ExpenseStatus } from '../dto/rental-expenses.dto';

@Injectable()
export class RentalExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(dto: CreateExpenseDto, recordedByUserId: string) {
    const property = await this.prisma.rentalProperty.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID '${dto.propertyId}' not found.`);
    }

    return {
      id: `exp-${Date.now()}`,
      organizationId: dto.organizationId,
      propertyId: dto.propertyId,
      buildingId: dto.buildingId,
      unitId: dto.unitId,
      category: dto.category,
      amount: dto.amount,
      description: dto.description,
      vendorId: dto.vendorId,
      receiptUrl: dto.receiptUrl,
      recordedByUserId,
      status: ExpenseStatus.SUBMITTED,
      createdAt: new Date(),
    };
  }

  async approveExpense(expenseId: string, dto: ApproveExpenseDto, approvedByUserId: string) {
    return {
      id: expenseId,
      status: dto.approved ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED,
      approvedByUserId,
      approvalNotes: dto.approvalNotes,
      updatedAt: new Date(),
    };
  }

  async getExpensesByProperty(propertyId: string) {
    return [
      {
        id: 'exp-101',
        propertyId,
        category: 'MAINTENANCE',
        description: 'Rose Valley #A-2 Master Bathroom pipe repair',
        amount: 8500.0,
        status: 'APPROVED',
        recordedBy: 'Subrata (Property Manager)',
        date: '12 Aug 2026',
      },
      {
        id: 'exp-102',
        propertyId,
        category: 'GENERATOR',
        description: 'Building diesel fuel refill (200 Liters)',
        amount: 22000.0,
        status: 'APPROVED',
        recordedBy: 'Rafiqul Islam (Caretaker)',
        date: '05 Aug 2026',
      },
    ];
  }

  async getOwnerFinancialSummary(ownerProfileId: string) {
    return {
      ownerProfileId,
      grossRentCollected: 620000.0,
      managementFees: 310000.0 * 0.1, // 5%
      totalExpensesDeducted: 8500.0,
      netOwnerPayout: 580500.0,
      disbursementStatus: 'DISBURSED',
      disbursedAt: new Date(),
    };
  }
}
