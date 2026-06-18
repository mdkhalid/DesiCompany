import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateQuoteDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
