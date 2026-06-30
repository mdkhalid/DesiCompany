import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ErrorLogsService } from '../error-logs/error-logs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ListErrorLogsQueryDto } from './dto/list-error-logs-query.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@ApiTags('Admin — Error Logs')
@ApiBearerAuth()
@Controller('admin/error-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminErrorLogsController {
  constructor(private readonly errorLogsService: ErrorLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List error logs (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated error logs' })
  async findAll(@Query() query: ListErrorLogsQueryDto) {
    const { page = 1, limit = 50, statusCode, userId } = query;
    return this.errorLogsService.findAll(page, limit, {
      statusCode,
      userId,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Error log statistics' })
  @ApiResponse({ status: 200, description: 'Aggregated error counts' })
  async getStats() {
    return this.errorLogsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single error log' })
  @ApiResponse({ status: 200, description: 'Error log detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    const errorLog = await this.errorLogsService.findOne(id);
    if (!errorLog) {
      throw new NotFoundException(`Error log ${id} not found`);
    }
    return errorLog;
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Mark an error log as resolved' })
  @ApiResponse({ status: 200, description: 'Error log resolved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async resolve(
    @Param('id') id: string,
    @Req() req: Request & AuthenticatedRequest,
  ) {
    const resolvedBy = req.user.id;
    const result = await this.errorLogsService.resolve(id, resolvedBy);
    if (!result) {
      throw new NotFoundException(`Error log ${id} not found`);
    }
    return result;
  }

  @Delete('purge')
  @ApiOperation({ summary: 'Purge error logs older than N days' })
  @ApiResponse({ status: 200, description: 'Number of records deleted' })
  async purge(@Query('days') days: string) {
    const retentionDays = parseInt(days, 10) || 30;
    const deleted = await this.errorLogsService.purgeOlderThan(retentionDays);
    return {
      deleted,
      message: `Purged ${deleted} error logs older than ${retentionDays} days`,
    };
  }
}
