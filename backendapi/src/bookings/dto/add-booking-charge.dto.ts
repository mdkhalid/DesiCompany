import { IsString, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';

export class AddBookingChargeDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  chargeType: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
