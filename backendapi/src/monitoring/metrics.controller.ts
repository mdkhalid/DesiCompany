import { Controller, Get, Res, Header } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    const contentType = this.metricsService.getContentType();
    res.setHeader('Content-Type', contentType);
    res.send(metrics);
  }
}
