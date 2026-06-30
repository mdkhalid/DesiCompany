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
      const route = req.route?.path || req.path;
      const method = req.method;
      const statusCode = res.statusCode.toString();

      this.metricsService.httpRequestDuration.observe(
        { method, route, status_code: statusCode },
        duration,
      );

      this.metricsService.httpRequestTotal.inc({
        method,
        route,
        status_code: statusCode,
      });

      if (res.statusCode >= 400) {
        this.metricsService.httpRequestErrors.inc({
          method,
          route,
          status_code: statusCode,
        });
      }
    });

    next();
  }
}
