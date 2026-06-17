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
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CreateBookingDto,
  UpdateBookingStatusDto,
  RescheduleBookingDto,
} from './dto/create-booking.dto';
import { AddBookingChargeDto } from './dto/add-booking-charge.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async create(@Body() dto: CreateBookingDto, @Req() req: AuthRequest) {
    if (dto.customerId === 'me' || !dto.customerId) {
      return this.bookingsService.createByUser(req.user.id, dto);
    }
    return this.bookingsService.create(dto);
  }

  @Get('customer/me')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  findMyCustomerBookings(@Req() req: AuthRequest) {
    return this.bookingsService.findByCustomerUser(req.user.id);
  }

  @Get('customer/:customerId')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  findByCustomer(@Param('customerId') customerId: string) {
    return this.bookingsService.findByCustomer(customerId);
  }

  @Get('provider/me')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  findMyProviderBookings(@Req() req: AuthRequest) {
    return this.bookingsService.findByProviderUser(req.user.id);
  }

  @Get('provider/:providerId')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  findByProvider(@Param('providerId') providerId: string) {
    return this.bookingsService.findByProvider(providerId);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
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
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @Req() req: AuthRequest,
  ) {
    return this.bookingsService.reschedule(id, dto, req.user.id, req.user.role);
  }

  @Post('charges')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  addCharge(@Body() dto: AddBookingChargeDto, @Req() req: AuthRequest) {
    return this.bookingsService.addCharge(dto, req.user.id, req.user.role);
  }

  @Delete('charges/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  removeCharge(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.bookingsService.removeCharge(id, req.user.id, req.user.role);
  }
}
