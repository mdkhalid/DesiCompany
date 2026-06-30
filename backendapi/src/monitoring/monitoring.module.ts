import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { SentryConfigModule } from './sentry.module';
import { LoggerConfigModule } from './logger.module';

@Module({
  imports: [SentryConfigModule, LoggerConfigModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
