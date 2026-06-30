import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLog } from './entities/error-log.entity';
import { ErrorLogsService } from './error-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorLog])],
  providers: [ErrorLogsService],
  exports: [ErrorLogsService],
})
export class ErrorLogsModule {}
