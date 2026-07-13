import { Injectable, Logger } from '@nestjs/common';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxCalls?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenCalls = 0;
        this.logger.log('Circuit breaker transitioning to half-open');
      } else {
        throw new Error('Circuit breaker is open — upstream unavailable');
      }
    }

    if (
      this.state === 'half-open' &&
      this.halfOpenCalls >= this.halfOpenMaxCalls
    ) {
      throw new Error(
        'Circuit breaker is half-open — waiting for probe result',
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      this.halfOpenCalls = 0;
      this.logger.log('Circuit breaker closed — upstream recovered');
    }
  }

  private onFailure(): void {
    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.halfOpenCalls = 0;
      this.logger.warn(
        `Circuit breaker opened after ${this.failures} failures — upstream degraded`,
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenCalls = 0;
    this.logger.log('Circuit breaker manually reset');
  }
}
