import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLog } from './entities/error-log.entity';
import { ErrorLogsService } from './error-logs.service';
import { ErrorSpikeDetector } from './error-spike-detector.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorLog])],
  providers: [ErrorLogsService, ErrorSpikeDetector],
  exports: [ErrorLogsService, ErrorSpikeDetector],
})
export class ErrorLogsModule {}
