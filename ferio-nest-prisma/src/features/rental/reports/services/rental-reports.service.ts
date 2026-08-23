import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { ReportQueryDto } from '../dto/rental-reports.dto';

@Injectable()
export class RentalReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPropertyProfitabilityReport(dto: ReportQueryDto) {
    return {
      period: 'August 2026',
      totalGrossRevenue: 2145000.0,
      totalOperatingExpenses: 945000.0,
      totalManagementFees: 107250.0,
      netOperatingIncome: 1092750.0,
      grossYieldPercentage: 8.4,
      netYieldPercentage: 6.8,
      properties: [
        {
          name: 'Rose Valley Heights',
          unitsCount: 24,
          grossIncome: 1080000.0,
          expenses: 30500.0,
          netYield: '7.2%',
        },
        {
          name: 'Gulshan Garden Residency',
          unitsCount: 12,
          grossIncome: 1065000.0,
          expenses: 64000.0,
          netYield: '6.5%',
        },
      ],
    };
  }

  async getOccupancyTrendReport(dto: ReportQueryDto) {
    return {
      totalPortfolioUnits: 36,
      occupiedUnits: 34,
      vacantUnits: 2,
      occupancyRate: 94.4,
      upcomingExpirationsNext60Days: 4,
      renewalPipeline: [
        { leaseNumber: 'LEASE-2025-001', unit: 'Rose Valley #A-1', expiryDate: '30 Sep 2026', tenant: 'Tanvir Hossain', status: 'RENEWAL_OFFER_SENT' },
        { leaseNumber: 'LEASE-2025-004', unit: 'Gulshan #2-B', expiryDate: '15 Oct 2026', tenant: 'Sultana Parveen', status: 'UNDER_NEGOTIATION' },
      ],
    };
  }

  async getMaintenanceSlaReport(dto: ReportQueryDto) {
    return {
      totalRequestsThisMonth: 18,
      resolvedRequests: 17,
      openRequests: 1,
      averageFirstResponseHours: 1.4,
      averageResolutionHours: 18.5,
      slaComplianceRate: 96.5,
    };
  }

  async getDepositLiabilityReport(dto: ReportQueryDto) {
    return {
      totalEscrowAccountsCount: 34,
      totalHeldDepositBalance: 3060000.0,
      pendingRefundsCount: 1,
      pendingRefundAmount: 90000.0,
      forfeitedDepositTotal: 0.0,
      escrowBankName: 'Dutch-Bangla Bank Escrow Custody A/C',
    };
  }
}
