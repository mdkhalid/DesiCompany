import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyReferralDto {
  @ApiProperty({ example: 'ABC12345', description: 'Referral code from friend' })
  @IsString()
  @Length(6, 8)
  @Matches(/^[A-Z0-9]+$/, { message: 'Referral code must be alphanumeric uppercase' })
  referralCode: string;
}

export class CreateReferralCodeDto {
  @ApiProperty({ example: 50, description: 'Credit amount for referrer' })
  referrerCreditAmount?: number;

  @ApiProperty({ example: 50, description: 'Credit amount for referred user' })
  referredCreditAmount?: number;
}
