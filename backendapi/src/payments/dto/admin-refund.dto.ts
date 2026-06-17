import { IsUUID, IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class AdminRefundDto {
  @IsUUID()
  paymentId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
