import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        serializers: {
          req(req: IncomingMessage) {
            return {
              method: req.method,
              url: req.url,
              query: (req as any).query,
              params: (req as any).params,
            };
          },
          res(res: ServerResponse) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
        redact: {
          remove: true,
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.token',
          ],
        },
        customSuccessMessage: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => {
          return `${req.method ?? 'UNKNOWN'} ${req.url ?? '/'} ${res.statusCode}`;
        },
        customErrorMessage: (
          req: IncomingMessage,
          res: ServerResponse,
          err: Error,
        ) => {
          return `${req.method ?? 'UNKNOWN'} ${req.url ?? '/'} ${res.statusCode} - ${err.message}`;
        },
      },
    }),
  ],
})
export class LoggerConfigModule {}
