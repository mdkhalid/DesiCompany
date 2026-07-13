import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

interface RequestWithQuery extends IncomingMessage {
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

const genReqId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        genReqId,
        serializers: {
          req(req: IncomingMessage) {
            const expressReq = req as RequestWithQuery;
            return {
              method: req.method,
              url: req.url,
              query: expressReq.query,
              params: expressReq.params,
              // Pino attaches `id` and `traceId` at runtime; suppress TS lint for these.
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              reqId: (req as any).id,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              traceId: (req as any).traceId,
            };
          },
          res(res: ServerResponse) {
            return {
              statusCode: res.statusCode,
              // Pino attaches `reqId` at runtime; suppress TS lint for this.
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              reqId: (res as any).reqId,
            };
          },
        },
        redact: {
          remove: true,
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.token',
            'req.body.card',
            'req.body.cvv',
            'req.body.accountNumber',
            'req.body.apiKey',
            'req.body.secret',
          ],
        },
        customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
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
