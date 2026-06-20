import { IsString, IsNotEmpty, IsEnum, MinLength } from 'class-validator';
import { DisputeStatus } from '../entities/dispute.entity';

export class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  @IsNotEmpty()
  status:
    | DisputeStatus.RESOLVED
    | DisputeStatus.DISMISSED
    | DisputeStatus.IN_REVIEW;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  resolution: string;
}
