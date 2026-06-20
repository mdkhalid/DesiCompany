import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  monthlyPrice: number;

  @IsOptional()
  @IsObject()
  benefits?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
