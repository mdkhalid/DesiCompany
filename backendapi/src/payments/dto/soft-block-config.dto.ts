import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateSoftBlockConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  thresholdMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lookbackDays?: number;
}
