import { IsOptional, IsString, MinLength } from 'class-validator';

export class TokenSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
