import { IsString, IsNotEmpty, IsUUID, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;
}
