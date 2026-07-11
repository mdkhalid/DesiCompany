import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateJobRequestDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;
}
