import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import {
  SupportTicketStatus,
  SupportTicketCategory,
} from './entities/support-ticket.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a support ticket' })
  createTicket(
    @Req() req: AuthRequest,
    @Body('subject') subject: string,
    @Body('description') description: string,
    @Body('category') category: SupportTicketCategory,
  ) {
    return this.supportService.createTicket(
      req.user.id,
      subject,
      description,
      category,
    );
  }

  @Get('tickets/my')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user support tickets' })
  getMyTickets(@Req() req: AuthRequest) {
    return this.supportService.getUserTickets(req.user.id);
  }

  @Get('tickets')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all support tickets (admin)' })
  getAllTickets(@Query('status') status?: SupportTicketStatus) {
    return this.supportService.getAllTickets(status);
  }

  @Get('tickets/:id')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get ticket by ID' })
  getTicket(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.ensureAccess(id, req.user.id, req.user.role);
  }

  @Patch('tickets/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update ticket status (admin)' })
  updateStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('status') status: SupportTicketStatus,
    @Body('notes') notes?: string,
  ) {
    return this.supportService.updateTicketStatus(
      id,
      status,
      notes,
      req.user.id,
    );
  }

  @Post('tickets/:id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add message to ticket' })
  addMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('message') message: string,
    @Body('attachmentUrl') attachmentUrl?: string,
  ) {
    return this.supportService.addMessage(
      id,
      req.user.id,
      message,
      req.user.role === UserRole.ADMIN,
      attachmentUrl,
    );
  }

  @Get('tickets/:id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get messages for a ticket' })
  getMessages(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService
      .ensureAccess(id, req.user.id, req.user.role)
      .then(() => this.supportService.getMessages(id));
  }
}
