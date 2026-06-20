import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  IsIn,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsString()
  @IsIn(['percentage', 'fixed', 'fee_waiver'])
  type: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  restrictions?: Record<string, any>;
}
