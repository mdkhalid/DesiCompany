import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class BookingServiceItemDto {
  @IsUUID()
  providerServiceId: string;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;

  @IsOptional()
  @IsNumber()
  estimatedDays?: number;
}

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsUUID()
  providerId: string;

  @IsUUID()
  providerServiceId: string;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  serviceAddress?: string;

  @IsOptional()
  @IsString()
  serviceCity?: string;

  @ApiPropertyOptional({
    description: 'Mark as urgent/emergency service',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional({
    description: 'Additional services for multi-service booking',
    type: [BookingServiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceItemDto)
  @ArrayMinSize(1)
  additionalServices?: BookingServiceItemDto[];

  @ApiPropertyOptional({
    description: 'Discount percent for multi-service bundle',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  bundleDiscountPercent?: number;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RescheduleBookingDto {
  @IsDateString()
  scheduledDate: string;
}

export class ProposeNewTimeDto {
  @IsDateString()
  proposedDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RespondToProposalDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
