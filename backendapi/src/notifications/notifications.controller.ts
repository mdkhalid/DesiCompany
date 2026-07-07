import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationsService } from './notifications.service';
import { NotificationGateway } from './notification.gateway';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationsService.findByUser(
      req.user.id,
      page,
      limit,
      req.user.role,
    );
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthRequest) {
    return this.notificationsService.getUnreadCount(req.user.id, req.user.role);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string, @Req() req: AuthRequest) {
    await this.notificationsService.markAsRead(id, req.user.id);
    const count = await this.notificationsService.getUnreadCount(req.user.id, req.user.role);
    this.notificationGateway.sendToUser(req.user.id, 'unread_count', { count });
    return { success: true };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req: AuthRequest) {
    await this.notificationsService.markAllAsRead(req.user.id, req.user.role);
    this.notificationGateway.sendToUser(req.user.id, 'unread_count', { count: 0 });
    return { success: true };
  }
}
