import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../../common/enums/booking-status.enum';

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

  @ApiPropertyOptional({ description: 'Mark as urgent/emergency service', default: false })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
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
