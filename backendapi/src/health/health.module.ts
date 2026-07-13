import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CacheService } from '../common/cache.service';
import { JobQueueService } from '../jobs/job-queue.service';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [MonitoringModule, JobsModule],
  controllers: [HealthController],
  providers: [CacheService, JobQueueService],
  exports: [CacheService, JobQueueService],
})
export class HealthModule {}
