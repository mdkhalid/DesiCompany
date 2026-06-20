import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CustomerFeedbacksService } from '../feedbacks/customer-feedbacks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

interface AuthenticatedRequest {
  user: { id: string; phone: string; role: UserRole };
}

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
}
