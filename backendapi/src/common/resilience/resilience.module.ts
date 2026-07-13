import { Module } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker.service';
import { TimeoutService } from './timeout.service';

@Module({
  providers: [CircuitBreaker, TimeoutService],
  exports: [CircuitBreaker, TimeoutService],
})
export class ResilienceModule {}
