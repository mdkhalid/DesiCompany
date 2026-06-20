import { IsString, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDateOverrideDto {
  @ApiProperty({ example: '2026-06-25' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD format' })
  overrideDate: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isAvailable: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Time must be HH:MM format',
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Time must be HH:MM format',
  })
  endTime?: string;

  @ApiPropertyOptional({ example: 'On vacation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class GetAvailableSlotsDto {
  @ApiProperty({ example: '2026-06-25' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiPropertyOptional({ example: 'provider-uuid' })
  @IsOptional()
  @IsString()
  providerId?: string;
}
