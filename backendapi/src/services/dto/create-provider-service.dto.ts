import { IsUUID, IsOptional, IsNumber, Min, IsIn } from 'class-validator';
import { PricingModel } from '../../common/enums/pricing-model.enum';

export class CreateProviderServiceDto {
  @IsUUID()
  providerId: string;

  @IsUUID()
  categoryId: string;

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
}
