import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

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
          req(req) {
            return {
              method: req.method,
              url: req.url,
              query: req.query,
              params: req.params,
            };
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
        redact: {
          remove: true,
          paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
        },
        customSuccessMessage: (req, res) => {
          return `${req.method} ${req.url} ${res.statusCode}`;
        },
        customErrorMessage: (req, res, err) => {
          return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
        },
      },
    }),
  ],
})
export class LoggerConfigModule {}
