import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CustomerFeedbacksService } from '../feedbacks/customer-feedbacks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly customerFeedbacksService: CustomerFeedbacksService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('bookings')
  @Roles(UserRole.ADMIN)
  findAllBookings() {
    return this.adminService.findAllBookings();
  }

  @Get('commissions')
  @Roles(UserRole.ADMIN)
  findAllCommissions() {
    return this.adminService.findAllCommissions();
  }

  @Get('reviews')
  @Roles(UserRole.ADMIN)
  findAllReviews() {
    return this.adminService.findAllReviews();
  }

  @Get('customer-feedbacks')
  @Roles(UserRole.ADMIN)
  findAllCustomerFeedbacks() {
    return this.customerFeedbacksService.findAll();
  }
}
