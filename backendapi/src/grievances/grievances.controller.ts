import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GrievancesService } from './grievances.service';
import { ChatbotService } from './chatbot.service';
import { GrievanceStatus, GrievancePriority, ResolutionType } from './entities/grievance.entity';

@ApiTags('Grievances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grievances')
export class GrievancesController {
  constructor(
    private readonly grievancesService: GrievancesService,
    private readonly chatbotService: ChatbotService,
  ) {}

  // ============ CUSTOMER ENDPOINTS ============

  @Get('check-eligibility/:bookingId')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Check if grievance can be raised for booking' })
  async checkEligibility(@Param('bookingId') bookingId: string) {
    return this.chatbotService.checkGrievanceEligibility(bookingId);
  }

  @Post('start/:bookingId')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Start a grievance for a booking (customer)' })
  async startGrievance(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.chatbotService.startGrievance(bookingId, req.user.id);
  }

  @Get('my-grievances')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get customer grievances' })
  async getMyGrievances(@Req() req: any) {
    return this.grievancesService.getAllGrievances();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get grievance categories' })
  async getCategories() {
    return this.chatbotService.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get grievance details' })
  async getGrievance(@Param('id') id: string) {
    return this.grievancesService.getGrievanceById(id);
  }

  @Post(':id/message')
  @ApiOperation({ summary: 'Send message to chatbot' })
  async sendMessage(
    @Param('id') id: string,
    @Body('message') message: string,
  ) {
    return this.chatbotService.processMessage(id, message);
  }

  @Post(':id/select-option')
  @ApiOperation({ summary: 'Select a chatbot option' })
  async selectOption(
    @Param('id') id: string,
    @Body('option') option: string,
  ) {
    return this.chatbotService.handleOptionSelection(id, option);
  }

  // ============ ADMIN ENDPOINTS ============

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all grievances (admin)' })
  @ApiQuery({ name: 'status', enum: GrievanceStatus, required: false })
  @ApiQuery({ name: 'priority', enum: GrievancePriority, required: false })
  async getAllGrievances(
    @Query('status') status?: GrievanceStatus,
    @Query('priority') priority?: GrievancePriority,
  ) {
    return this.grievancesService.getAllGrievances({ status, priority });
  }

  @Get('admin/escalated')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get escalated grievances (admin)' })
  async getEscalatedGrievances() {
    return this.grievancesService.getEscalatedGrievances();
  }

  @Get('admin/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get grievance dashboard stats (admin)' })
  async getDashboardStats() {
    return this.grievancesService.getDashboardStats();
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get grievance details (admin)' })
  async getGrievanceAdmin(@Param('id') id: string) {
    return this.grievancesService.getGrievanceById(id);
  }

  @Put('admin/:id/assign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign grievance to admin' })
  async assignToAdmin(@Req() req: any, @Param('id') id: string) {
    return this.grievancesService.assignToAdmin(id, req.user.id);
  }

  @Put('admin/:id/resolve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve a grievance' })
  async resolveGrievance(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      resolutionType: ResolutionType;
      resolutionDetails: string;
      adminNotes?: string;
    },
  ) {
    return this.grievancesService.resolveGrievance(id, req.user.id, body);
  }

  @Put('admin/:id/record-call')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Record admin call to customer' })
  async recordCall(
    @Req() req: any,
    @Param('id') id: string,
    @Body('callNotes') callNotes: string,
  ) {
    return this.grievancesService.recordCall(id, req.user.id, callNotes);
  }

  @Post('admin/:id/message')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send admin message to customer' })
  async sendAdminMessage(
    @Param('id') id: string,
    @Body('message') message: string,
  ) {
    return this.grievancesService.addAdminMessage(id, message);
  }
}
