import { IsString, MinLength } from 'class-validator';

export class SuspendUserDto {
  @IsString()
  @MinLength(10)
  reason: string;
}
