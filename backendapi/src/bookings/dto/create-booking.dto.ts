import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class CreateBookingDto {
  @IsUUID()
  customerId: string;

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
