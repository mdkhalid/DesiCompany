import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
} from 'class-validator';
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
