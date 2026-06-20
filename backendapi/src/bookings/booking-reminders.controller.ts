import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BookingRemindersService } from './booking-reminders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Booking Reminders')
@ApiBearerAuth()
@Controller('reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingRemindersController {
  constructor(
    private readonly remindersService: BookingRemindersService,
  ) {}

  @Post('upcoming')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send reminders for upcoming bookings (cron endpoint)' })
  @ApiResponse({ status: 200, description: 'Reminders sent' })
  sendUpcomingReminders() {
    return this.remindersService.sendUpcomingBookingReminders();
  }

  @Post('completion')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send review reminders for completed bookings' })
  @ApiResponse({ status: 200, description: 'Review reminders sent' })
  sendCompletionReminders() {
    return this.remindersService.sendCompletionReminders();
  }
}
