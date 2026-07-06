import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateQuoteItemDto {
  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}
