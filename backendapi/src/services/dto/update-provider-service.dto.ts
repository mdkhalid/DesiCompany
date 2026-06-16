import { IsUUID, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdateProviderServiceDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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
  @IsBoolean()
  isActive?: boolean;
}
