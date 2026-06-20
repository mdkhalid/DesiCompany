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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
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

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AnalyticsService,
    private readonly customerFeedbacksService: CustomerFeedbacksService,
    private readonly notificationsService: NotificationsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @ApiResponse({ status: 200, description: 'Returns dashboard data' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('analytics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get full analytics dashboard' })
  @ApiResponse({ status: 200, description: 'Returns analytics data' })
  getAnalytics() {
    return this.analyticsService.getDashboardAnalytics();
  }

  @Get('analytics/revenue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get revenue analytics' })
  @ApiResponse({ status: 200, description: 'Returns revenue data' })
  getRevenueAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getRevenueAnalytics(startDate, endDate);
  }

  @Get('analytics/providers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get provider analytics' })
  @ApiResponse({ status: 200, description: 'Returns provider analytics' })
  getProviderAnalytics() {
    return this.analyticsService.getProviderAnalytics();
  }

  @Get('analytics/categories')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get category analytics' })
  @ApiResponse({ status: 200, description: 'Returns category analytics' })
  getCategoryAnalytics() {
    return this.analyticsService.getCategoryAnalytics();
  }

  @Get('bookings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all bookings' })
  @ApiResponse({ status: 200, description: 'Returns all bookings' })
  findAllBookings() {
    return this.adminService.findAllBookings();
  }

  @Get('commissions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all commission configs' })
  @ApiResponse({ status: 200, description: 'Returns commission configs' })
  findAllCommissions() {
    return this.adminService.findAllCommissions();
  }

  @Get('reviews')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all reviews' })
  @ApiResponse({ status: 200, description: 'Returns all reviews' })
  findAllReviews() {
    return this.adminService.findAllReviews();
  }

  @Get('customer-feedbacks')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all customer feedbacks' })
  @ApiResponse({ status: 200, description: 'Returns all feedbacks' })
  findAllCustomerFeedbacks() {
    return this.customerFeedbacksService.findAll();
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create admin user' })
  @ApiResponse({ status: 201, description: 'Admin created' })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List users with filtering' })
  @ApiResponse({ status: 200, description: 'Returns filtered users' })
  findAllUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.findUsers(query);
  }

  @Patch('users/:id/suspend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend a user' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  suspendUser(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.suspendUser(id, dto, req.user.id);
  }

  @Patch('users/:id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate a user' })
  @ApiResponse({ status: 200, description: 'User activated' })
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Patch('providers/:id/unblock')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Unblock a soft-blocked provider' })
  @ApiResponse({ status: 200, description: 'Provider unblocked' })
  unblockProvider(@Param('id') id: string) {
    return this.adminService.unblockProvider(id);
  }

  @Delete('users/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  deleteUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  @Post('commissions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create commission config' })
  @ApiResponse({ status: 201, description: 'Commission config created' })
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
  @ApiOperation({ summary: 'Update commission config' })
  @ApiResponse({ status: 200, description: 'Commission config updated' })
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
  @ApiOperation({ summary: 'Delete commission config' })
  @ApiResponse({ status: 200, description: 'Commission config deleted' })
  deleteCommissionConfig(@Param('id') id: string) {
    return this.adminService.deleteCommissionConfig(id);
  }

  @Post('notifications/broadcast')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Broadcast notification to users' })
  @ApiResponse({ status: 201, description: 'Notification broadcasted' })
  broadcastNotification(
    @Body('title') title: string,
    @Body('message') message: string,
    @Body('role') role?: UserRole,
  ) {
    return this.notificationsService.broadcast(title, message, role);
  }

  @Delete('reviews/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.delete(id);
  }
}
