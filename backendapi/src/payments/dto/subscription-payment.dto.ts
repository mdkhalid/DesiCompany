import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

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

export class CreateMembershipOrderDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billingCycle?: 'monthly' | 'yearly';
}

export class VerifyMembershipPaymentDto {
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

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billingCycle?: 'monthly' | 'yearly';
}
