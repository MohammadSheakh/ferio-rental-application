import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalDocumentCategory } from '@prisma/client';

export class UploadRentalDocumentDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'National ID Card (Front & Back)' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ enum: RentalDocumentCategory, example: RentalDocumentCategory.TENANT })
  @IsEnum(RentalDocumentCategory)
  category: RentalDocumentCategory;

  @ApiProperty({ example: 'NID' })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiProperty({ example: 'TENANT' })
  @IsString()
  @IsNotEmpty()
  resourceType: string;

  @ApiProperty({ example: 'person-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @ApiProperty({ example: 'https://storage.ferio.com/docs/nid-tanvir-01.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiPropertyOptional({ example: 1048576, default: 0 })
  @IsNumber()
  @IsOptional()
  fileSize?: number;
}
