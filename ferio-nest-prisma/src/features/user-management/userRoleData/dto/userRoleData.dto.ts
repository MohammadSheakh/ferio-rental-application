import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProviderApprovalStatus, RoleDataAdminStatus } from '@prisma/client';

export class CreateUserRoleDataDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiPropertyOptional({ enum: RoleDataAdminStatus })
  @IsOptional()
  @IsEnum(RoleDataAdminStatus)
  adminStatus?: RoleDataAdminStatus;

  @ApiPropertyOptional({ enum: ProviderApprovalStatus })
  @IsOptional()
  @IsEnum(ProviderApprovalStatus)
  providerApprovalStatus?: ProviderApprovalStatus;
}

export class UpdateUserRoleDataDto {
  @ApiPropertyOptional({ enum: RoleDataAdminStatus })
  @IsOptional()
  @IsEnum(RoleDataAdminStatus)
  adminStatus?: RoleDataAdminStatus;

  @ApiPropertyOptional({ enum: ProviderApprovalStatus })
  @IsOptional()
  @IsEnum(ProviderApprovalStatus)
  providerApprovalStatus?: ProviderApprovalStatus;
}
