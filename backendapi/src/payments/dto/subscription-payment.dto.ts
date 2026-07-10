import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionOrderDto {
  @IsString()
  @IsNotEmpty()
  planId: string;
}

export class VerifySubscriptionPaymentDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;
}
