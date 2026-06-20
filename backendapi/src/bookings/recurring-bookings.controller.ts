import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RecurringBookingsService } from './recurring-bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CreateRecurringBookingDto,
  UpdateRecurringBookingDto,
} from './dto/recurring-booking.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('Recurring Bookings')
@ApiBearerAuth()
@Controller('recurring-bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringBookingsController {
  constructor(
    private readonly recurringBookingsService: RecurringBookingsService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Create a recurring booking' })
  @ApiResponse({ status: 201, description: 'Recurring booking created' })
  create(@Req() req: AuthRequest, @Body() dto: CreateRecurringBookingDto) {
    return this.recurringBookingsService.create(req.user.id, dto);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all recurring bookings for current user' })
  findAll(@Req() req: AuthRequest) {
    return this.recurringBookingsService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get recurring booking by ID' })
  findOne(@Param('id') id: string) {
    return this.recurringBookingsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update recurring booking status/time' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringBookingDto,
    @Req() req: AuthRequest,
  ) {
    return this.recurringBookingsService.updateStatus(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Post(':id/generate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger occurrence generation' })
  generateOccurrence(@Param('id') id: string) {
    return this.recurringBookingsService.generateOccurrence(id);
  }

  @Post('process-due')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Process all due recurring bookings (cron endpoint)',
  })
  processDue() {
    return this.recurringBookingsService.processDueRecurringBookings();
  }
}
