import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CreateBookingDto,
  UpdateBookingStatusDto,
  RescheduleBookingDto,
  ProposeNewTimeDto,
} from './dto/create-booking.dto';
import { AddBookingChargeDto } from './dto/add-booking-charge.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 404, description: 'Provider or customer not found' })
  async create(@Body() dto: CreateBookingDto, @Req() req: AuthRequest) {
    if (dto.customerId === 'me' || !dto.customerId) {
      return this.bookingsService.createByUser(req.user.id, dto);
    }
    return this.bookingsService.create(dto);
  }

  @Get('customer/me')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current customer bookings' })
  @ApiResponse({ status: 200, description: 'Returns customer bookings' })
  findMyCustomerBookings(@Req() req: AuthRequest) {
    return this.bookingsService.findByCustomerUser(req.user.id);
  }

  @Get('customer/:customerId')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get bookings by customer ID' })
  @ApiResponse({ status: 200, description: 'Returns customer bookings' })
  findByCustomer(@Param('customerId') customerId: string) {
    return this.bookingsService.findByCustomer(customerId);
  }

  @Get('provider/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current provider bookings' })
  @ApiResponse({ status: 200, description: 'Returns provider bookings' })
  findMyProviderBookings(@Req() req: AuthRequest) {
    return this.bookingsService.findByProviderUser(req.user.id);
  }

  @Get('provider/:providerId')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get bookings by provider ID' })
  @ApiResponse({ status: 200, description: 'Returns provider bookings' })
  findByProvider(@Param('providerId') providerId: string) {
    return this.bookingsService.findByProvider(providerId);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Returns booking details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update booking status' })
  @ApiResponse({ status: 200, description: 'Booking status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.bookingsService.updateStatus(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id/reschedule')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiResponse({ status: 200, description: 'Booking rescheduled' })
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @Req() req: AuthRequest,
  ) {
    return this.bookingsService.reschedule(id, dto, req.user.id, req.user.role);
  }

  @Post(':id/propose-time')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Propose a new time for a booking' })
  @ApiResponse({ status: 200, description: 'Time proposal sent' })
  proposeNewTime(
    @Param('id') id: string,
    @Body() dto: ProposeNewTimeDto,
    @Req() req: AuthRequest,
  ) {
    return this.bookingsService.proposeNewTime(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Post(':id/respond-proposal')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Accept or decline a time proposal' })
  @ApiResponse({ status: 200, description: 'Proposal response recorded' })
  respondToProposal(
    @Param('id') id: string,
    @Body('accept') accept: boolean,
    @Req() req: AuthRequest,
  ) {
    return this.bookingsService.respondToProposal(
      id,
      accept,
      req.user.id,
      req.user.role,
    );
  }

  @Post('charges')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a charge to a booking' })
  @ApiResponse({ status: 201, description: 'Charge added successfully' })
  addCharge(@Body() dto: AddBookingChargeDto, @Req() req: AuthRequest) {
    return this.bookingsService.addCharge(dto, req.user.id, req.user.role);
  }

  @Delete('charges/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a charge from a booking' })
  @ApiResponse({ status: 200, description: 'Charge removed successfully' })
  removeCharge(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.bookingsService.removeCharge(id, req.user.id, req.user.role);
  }
}
