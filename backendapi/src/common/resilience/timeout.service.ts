import { Injectable, Logger } from '@nestjs/common';

export interface TimeoutOptions {
  ms?: number;
  message?: string;
}

@Injectable()
export class TimeoutService {
  private readonly logger = new Logger(TimeoutService.name);

  withTimeout<T>(
    fn: () => Promise<T>,
    options: TimeoutOptions = {},
  ): Promise<T> {
    const ms = options.ms ?? 10_000;
    const message = options.message ?? 'Operation timed out';

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, ms);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  withAbortSignal<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    options: TimeoutOptions = {},
  ): Promise<T> {
    const ms = options.ms ?? 10_000;
    const message = options.message ?? 'Operation timed out';

    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error(message));
      }, ms);

      fn(controller.signal)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          if ((err as Error).name === 'AbortError') {
            reject(new Error(message));
          } else {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
    });
  }
}
