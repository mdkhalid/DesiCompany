import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';
import { ErrorLogsService } from '../../error-logs/error-logs.service';
import { ErrorCategory } from '../../error-logs/enums/error-category.enum';
import { redactObject } from '../../error-logs/redact.util';
import { generateFingerprint } from '../../error-logs/fingerprint.util';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly errorLogsService: ErrorLogsService) {}

  private categoriseError(
    exception: HttpException,
    status: number,
  ): ErrorCategory {
    const name = exception.constructor.name;

    if (
      status === 400 ||
      status === 422 ||
      name === 'BadRequestException' ||
      name === 'ValidationPipeException' ||
      name === 'UnprocessableEntityException'
    ) {
      return ErrorCategory.VALIDATION;
    }

    if (
      status === 401 ||
      status === 403 ||
      name === 'UnauthorizedException' ||
      name === 'ForbiddenException' ||
      name === 'NotAuthenticatedException'
    ) {
      return ErrorCategory.AUTH;
    }

    if (
      name.includes('QueryFailedError') ||
      name.includes('ConnectionError') ||
      name.includes('TypeORMError') ||
      name.includes('MongoError') ||
      status === 503
    ) {
      return ErrorCategory.DATABASE;
    }

    if (
      status === 502 ||
      status === 504 ||
      name === 'BadGatewayException' ||
      name === 'GatewayTimeoutException'
    ) {
      return ErrorCategory.EXTERNAL;
    }

    if (status >= 500) {
      return ErrorCategory.INTERNAL;
    }

    if (status >= 400) {
      return ErrorCategory.VALIDATION;
    }

    return ErrorCategory.INTERNAL;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: string | undefined;
    let category: ErrorCategory = ErrorCategory.INTERNAL;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        errorCode = HttpException.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        const responseMessage = resObj.message;
        if (typeof responseMessage === 'string') {
          message = responseMessage;
        } else if (Array.isArray(responseMessage)) {
          message = responseMessage
            .filter((m): m is string => typeof m === 'string')
            .join(', ');
        }
        errorCode =
          (resObj.errorCode as string | undefined) ?? HttpException.name;
      }
      category = this.categoriseError(exception, status);
    } else if (process.env.NODE_ENV !== 'production') {
      message = (exception as Error)?.message ?? message;
    }

    // Capture 5xx errors in Sentry
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setExtra('method', request.method);
        scope.setExtra('url', request.url);
        scope.setExtra('ip', request.ip);
        if (exception instanceof Error) {
          Sentry.captureException(exception);
        } else {
          Sentry.captureException(new Error(String(exception)));
        }
      });
    }

    // Log error with context
    const errorLog = {
      statusCode: status,
      message,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    if (status >= 500) {
      this.logger.error(errorLog, (exception as Error)?.stack);
    } else if (status >= 400) {
      this.logger.warn(errorLog);
    }

    // Persist error to DB (fire-and-forget — never block the response)
    if (status >= 400) {
      const userId =
        (request as Request & { user?: { id?: string } }).user?.id ?? undefined;

      const rawBody = (request as unknown as Record<string, unknown>).body as
        | Record<string, unknown>
        | undefined;
      const requestBody = rawBody
        ? (redactObject(rawBody) ?? undefined)
        : undefined;

      const fingerprint = generateFingerprint(
        status,
        request.url,
        message,
        userId,
      );

      this.errorLogsService
        .create({
          statusCode: status,
          message,
          errorCode,
          category,
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.get('user-agent'),
          stack: status >= 500 ? (exception as Error)?.stack : undefined,
          userId,
          requestBody,
          fingerprint,
        })
        .catch((err: Error) => {
          this.logger.error('Failed to persist error log', err);
        });
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
