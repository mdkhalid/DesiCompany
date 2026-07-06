import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuoteItemDto } from './create-quote-item.dto';

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  @ArrayMinSize(1)
  items?: CreateQuoteItemDto[];
}
