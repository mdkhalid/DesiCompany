import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const route = req.route?.path ? String(req.route.path) : req.path;
      const method = req.method;
      const statusCode = res.statusCode.toString();

      const labels = { method, route, status_code: statusCode };

      this.metricsService.httpRequestDuration.observe(labels, duration);
      this.metricsService.httpRequestTotal.inc(labels);
      if (res.statusCode >= 400) {
        this.metricsService.httpRequestErrors.inc(labels);
      }
    });

    next();
  }
}
