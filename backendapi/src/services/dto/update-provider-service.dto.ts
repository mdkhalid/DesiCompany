import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { PricingModel } from '../../common/enums/pricing-model.enum';

export class UpdateProviderServiceDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(Object.values(PricingModel))
  pricingModel?: PricingModel;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
