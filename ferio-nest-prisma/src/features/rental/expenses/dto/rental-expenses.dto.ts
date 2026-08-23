import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExpenseCategory {
  MAINTENANCE = 'MAINTENANCE',
  SECURITY = 'SECURITY',
  CLEANING = 'CLEANING',
  GENERATOR = 'GENERATOR',
  LIFT = 'LIFT',
  COMMON_UTILITY = 'COMMON_UTILITY',
  STAFF = 'STAFF',
  PROPERTY_TAX = 'PROPERTY_TAX',
  MANAGEMENT = 'MANAGEMENT',
  LEGAL = 'LEGAL',
  OTHER = 'OTHER',
}

export enum ExpenseStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export class CreateExpenseDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'property-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiPropertyOptional({ example: 'building-uuid-v4' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ example: 'unit-uuid-v4' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.MAINTENANCE })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ example: 8500.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'Rose Valley #A-2 Master Bathroom pipe repair' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'vendor-uuid-v4' })
  @IsString()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ example: 'https://storage.ferio.com/expenses/receipt-88.pdf' })
  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class ApproveExpenseDto {
  @ApiProperty({ example: true })
  approved: boolean;

  @ApiPropertyOptional({ example: 'Approved for August landlord disbursement deduction' })
  @IsString()
  @IsOptional()
  approvalNotes?: string;
}
