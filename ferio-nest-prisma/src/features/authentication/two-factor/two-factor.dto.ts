import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class TwoFactorChallengeDto extends TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  challengeToken: string;
}

export class DisableTwoFactorDto extends TwoFactorCodeDto {
  @IsString()
  @MinLength(8)
  password: string;
}
