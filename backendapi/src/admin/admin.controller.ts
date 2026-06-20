import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CustomerFeedbacksService } from '../feedbacks/customer-feedbacks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewsService } from '../reviews/reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { CommissionType } from '../common/enums/commission-type.enum';

interface AuthenticatedRequest {
  user: { id: string; phone: string; role: UserRole };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly customerFeedbacksService: CustomerFeedbacksService,
    private readonly notificationsService: NotificationsService,
    private readonly reviewsService: ReviewsService,
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

  @Post('users')
  @Roles(UserRole.ADMIN)
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  findAllUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.findUsers(query);
  }

  @Patch('users/:id/suspend')
  @Roles(UserRole.ADMIN)
  suspendUser(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.suspendUser(id, dto, req.user.id);
  }

  @Patch('users/:id/activate')
  @Roles(UserRole.ADMIN)
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Patch('providers/:id/unblock')
  @Roles(UserRole.ADMIN)
  unblockProvider(@Param('id') id: string) {
    return this.adminService.unblockProvider(id);
  }

  @Delete('users/:id')
  @Roles(UserRole.ADMIN)
  deleteUser(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  @Post('commissions')
  @Roles(UserRole.ADMIN)
  createCommissionConfig(
    @Body('scope') scope: string,
    @Body('type') type: CommissionType,
    @Body('value') value: number,
    @Body('scopeId') scopeId?: string,
  ) {
    return this.adminService.createCommissionConfig({
      scope,
      scopeId,
      type,
      value,
    });
  }

  @Patch('commissions/:id')
  @Roles(UserRole.ADMIN)
  updateCommissionConfig(
    @Param('id') id: string,
    @Body('type') type?: CommissionType,
    @Body('value') value?: number,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.adminService.updateCommissionConfig(id, {
      type,
      value,
      isActive,
    });
  }

  @Delete('commissions/:id')
  @Roles(UserRole.ADMIN)
  deleteCommissionConfig(@Param('id') id: string) {
    return this.adminService.deleteCommissionConfig(id);
  }

  @Post('notifications/broadcast')
  @Roles(UserRole.ADMIN)
  broadcastNotification(
    @Body('title') title: string,
    @Body('message') message: string,
    @Body('role') role?: UserRole,
  ) {
    return this.notificationsService.broadcast(title, message, role);
  }

  @Delete('reviews/:id')
  @Roles(UserRole.ADMIN)
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.delete(id);
  }
}
