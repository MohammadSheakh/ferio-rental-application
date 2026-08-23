import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  IsIn,
} from 'class-validator';
import {
  PropertyType,
  UnitType,
  ChargeCategory,
  PaymentMethod,
  UtilityScope,
  UtilityResponsibility,
  AllocationMethod,
  MaintenanceScope,
  MaintenanceUrgency,
  MaintenanceStatus,
  MaintenancePayer,
} from '@prisma/tenant-client';

export class CreateTenantPropertyDto {
  @ApiProperty({
    description: 'Property display name',
    example: 'Rahman Tower',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: PropertyType, example: 'RESIDENTIAL_BUILDING' })
  @IsEnum(PropertyType)
  type!: PropertyType;

  @ApiPropertyOptional({ example: 'House 12, Road 4, Block C' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Rampura' })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsString()
  @IsOptional()
  district?: string;
}

export class CreateTenantUnitDto {
  @ApiProperty({ description: 'Property ID' })
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @ApiPropertyOptional({
    description: 'Building ID if part of multi-building property',
  })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiProperty({ description: 'Unit number / code', example: 'A-4' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: UnitType, example: 'APARTMENT' })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiPropertyOptional({ example: 4 })
  @IsNumber()
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @ApiPropertyOptional({ example: 1450 })
  @IsNumber()
  @IsOptional()
  areaSqFt?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  parking?: number;
}

export class CreateTenantRenterDto {
  @ApiProperty({ description: 'Renter full name', example: 'Kabir Hossain' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Central identity user ID (portal login)' })
  @IsString()
  @IsOptional()
  centralUserId?: string;

  @ApiPropertyOptional({ description: 'National ID (NID) number', example: '19902692512000001' })
  @IsString()
  @IsOptional()
  nidNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: '01711000000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'kabir@gmail.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsString()
  @IsOptional()
  profession?: string;
}

export class CreateTenantLeaseDto {
  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ description: 'Renter ID' })
  @IsString()
  @IsNotEmpty()
  renterId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2027-08-31' })
  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(0)
  monthlyRent!: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsNumber()
  @IsOptional()
  securityDeposit?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  advanceMonths?: number;
}

export class AddChargeDefinitionDto {
  @ApiProperty({ description: 'Billing Account ID' })
  @IsString()
  @IsNotEmpty()
  billingAccountId!: string;

  @ApiProperty({ enum: ChargeCategory, example: 'RENT' })
  @IsEnum(ChargeCategory)
  category!: ChargeCategory;

  @ApiProperty({ example: 'Monthly Apartment Rent' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 'Mr. Rahman (Unit Owner)' })
  @IsString()
  @IsOptional()
  beneficiaryName?: string;

  @ApiPropertyOptional({ example: 'UNIT_OWNER' })
  @IsString()
  @IsOptional()
  beneficiaryType?: string;
}

export class GenerateInvoiceDto {
  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  @IsNotEmpty()
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsString()
  @IsNotEmpty()
  periodEnd!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsString()
  @IsNotEmpty()
  dueDate!: string;
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ enum: PaymentMethod, example: 'BKASH' })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: '8M8A123456' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    example: 'https://storage.ferio.com/proofs/bkash.jpg',
  })
  @IsString()
  @IsOptional()
  proofUrl?: string;

  @ApiPropertyOptional({ example: 'Paid via bKash Merchant' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateUtilityAccountDto {
  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiProperty({ enum: UtilityScope, example: 'UNIT' })
  @IsEnum(UtilityScope)
  scope!: UtilityScope;

  @ApiProperty({ example: 'ELECTRICITY' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ example: 'DESCO' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ enum: UtilityResponsibility, example: 'RENTER' })
  @IsEnum(UtilityResponsibility)
  @IsOptional()
  responsibility?: UtilityResponsibility;
}

export class CreateMeterDto {
  @ApiProperty({ description: 'Utility account ID' })
  @IsString()
  @IsNotEmpty()
  utilityAccountId!: string;

  @ApiPropertyOptional({ example: 'DESCO-991' })
  @IsString()
  @IsOptional()
  meterNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;
}

export class RecordMeterReadingDto {
  @ApiProperty({ description: 'Meter ID' })
  @IsString()
  @IsNotEmpty()
  meterId!: string;

  @ApiProperty({ example: 1050.5 })
  @IsNumber()
  previousReading!: number;

  @ApiProperty({ example: 1210.0 })
  @IsNumber()
  currentReading!: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  @IsNotEmpty()
  readingDate!: string;

  @ApiPropertyOptional({ example: 'Caretaker Jamal' })
  @IsString()
  @IsOptional()
  readerName?: string;

  @ApiPropertyOptional({ example: 'https://storage.ferio.com/meters/m12.jpg' })
  @IsString()
  @IsOptional()
  photoUrl?: string;
}

export class CreateMaintenanceRequestDto {
  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiProperty({ enum: MaintenanceScope, example: 'UNIT' })
  @IsEnum(MaintenanceScope)
  scope!: MaintenanceScope;

  @ApiPropertyOptional({ enum: MaintenanceUrgency, example: 'URGENT' })
  @IsEnum(MaintenanceUrgency)
  @IsOptional()
  urgency?: MaintenanceUrgency;

  @ApiPropertyOptional({
    enum: MaintenancePayer,
    example: 'BUILDING_MANAGEMENT',
  })
  @IsEnum(MaintenancePayer)
  @IsOptional()
  payer?: MaintenancePayer;

  @ApiProperty({ example: 'Bathroom Water Leakage' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'Water leaking from main pipe under sink' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: ['https://storage.ferio.com/maint/leak1.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photoUrls?: string[];
}

export class AssignWorkOrderDto {
  @ApiProperty({ description: 'Maintenance Request ID' })
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @ApiProperty({ example: 'Plumber Abdul' })
  @IsString()
  @IsNotEmpty()
  assignedTo!: string;

  @ApiPropertyOptional({ example: '01811000000' })
  @IsString()
  @IsOptional()
  assignedPhone?: string;

  @ApiPropertyOptional({ example: '2026-09-02' })
  @IsString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 'Replace 1/2 inch PVC elbow joint' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 1500 })
  @IsNumber()
  @IsOptional()
  cost?: number;
}
