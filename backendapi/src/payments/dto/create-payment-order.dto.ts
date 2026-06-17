import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
