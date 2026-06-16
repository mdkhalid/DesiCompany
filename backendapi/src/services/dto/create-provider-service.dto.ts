import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateProviderServiceDto {
  @IsUUID()
  providerId: string;

  @IsUUID()
  categoryId: string;

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
}
