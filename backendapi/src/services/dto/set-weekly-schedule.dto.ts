import { IsArray, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WeeklySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be HH:MM' })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be HH:MM' })
  endTime: string;
}

export class SetWeeklyScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklySlotDto)
  slots: WeeklySlotDto[];
}
