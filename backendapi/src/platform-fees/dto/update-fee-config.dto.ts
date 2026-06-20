import { IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateFeeConfigDto {
  @IsOptional()
  @IsObject()
  configValue?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
