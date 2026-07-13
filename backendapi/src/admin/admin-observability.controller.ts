import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { MetricsService } from '../monitoring/metrics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { DataSource } from 'typeorm';
import { ErrorSpikeDetector } from '../error-logs/error-spike-detector.service';

@ApiTags('Admin — Observability')
@ApiBearerAuth()
@Controller('admin/observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminObservabilityController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly errorSpikeDetector: ErrorSpikeDetector,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get Prometheus metrics text' })
  @ApiResponse({ status: 200, description: 'Prometheus formatted metrics' })
  async getPrometheusMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Get extended health check with observability data',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status with metrics context',
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      prometheus: '/admin/observability/metrics',
    };
  }
}
