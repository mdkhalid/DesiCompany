import { IsUUID, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class PayCashDto {
  @IsUUID()
  bookingId: string;
}

export class MarkCashReceivedDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
