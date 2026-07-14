import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

/**
 * Recursively converts decimal/numeric strings (e.g. "149.00", "0.00")
 * in API responses to JavaScript numbers so Flutter clients don't
 * need to call num.tryParse() on every money/price field.
 */
@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data) => this.transform(data)));
  }

  private transform(value: unknown): unknown {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) return value;

    if (typeof value === 'string') {
      if (/^-?\d+\.\d{1,6}$/.test(value)) {
        const num = Number(value);
        if (!isNaN(num)) return num;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        result[key] = this.transform((value as Record<string, unknown>)[key]);
      }
      return result;
    }

    return value;
  }
}
