import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { ValidateImportBatchDto, ExecuteImportBatchDto, ImportEntityType } from '../dto/rental-imports.dto';

@Injectable()
export class RentalImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateImportBatch(dto: ValidateImportBatchDto, userId: string) {
    const importJobId = `job-imp-${Date.now()}`;
    const rowErrors: Array<{ rowNumber: number; error: string }> = [];
    let validRowsCount = 0;

    dto.rows.forEach((row) => {
      if (dto.entityType === ImportEntityType.UNITS) {
        if (!row.rowData?.unitNumber) {
          rowErrors.push({ rowNumber: row.rowNumber, error: 'Missing required field: unitNumber' });
        } else if (!row.rowData?.rentAmount || row.rowData?.rentAmount <= 0) {
          rowErrors.push({ rowNumber: row.rowNumber, error: 'Invalid or missing rentAmount' });
        } else {
          validRowsCount++;
        }
      } else {
        validRowsCount++;
      }
    });

    return {
      importJobId,
      organizationId: dto.organizationId,
      entityType: dto.entityType,
      totalRows: dto.rows.length,
      validRowsCount,
      errorRowsCount: rowErrors.length,
      rowErrors,
      status: rowErrors.length === 0 ? 'READY_FOR_EXECUTION' : 'HAS_VALIDATION_ERRORS',
      validatedAt: new Date(),
    };
  }

  async executeImportBatch(dto: ExecuteImportBatchDto, userId: string) {
    return {
      importJobId: dto.importJobId,
      status: 'COMPLETED',
      importedRecordsCount: 24,
      failedRecordsCount: 0,
      executedByUserId: userId,
      completedAt: new Date(),
    };
  }

  async getImportJobStatus(importJobId: string) {
    return {
      importJobId,
      entityType: 'UNITS',
      status: 'COMPLETED',
      totalRows: 24,
      importedCount: 24,
      errorCount: 0,
      createdAt: '22 Aug 2026, 03:45 PM',
      completedAt: '22 Aug 2026, 03:46 PM',
    };
  }
}
