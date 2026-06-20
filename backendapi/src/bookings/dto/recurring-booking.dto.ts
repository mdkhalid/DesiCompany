import {
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency } from '../entities/recurring-booking.entity';

export class CreateRecurringBookingDto {
  @ApiProperty({ example: 'uuid-of-provider' })
  @IsUUID()
  providerId: string;

  @ApiProperty({ example: 'uuid-of-provider-service' })
  @IsUUID()
  providerServiceId: string;

  @ApiProperty({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.WEEKLY,
  })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({ example: 1, description: '0=Sunday, 1=Monday, etc.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: 15, description: 'Day of month (1-28)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Time must be HH:MM format',
  })
  preferredTime?: string;

  @ApiPropertyOptional({ example: 'Weekly plumbing maintenance' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-06-25', description: 'First occurrence date' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;
}

export class UpdateRecurringBookingDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '11:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  preferredTime?: string;
}
