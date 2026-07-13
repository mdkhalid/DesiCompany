import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Logger } from 'nestjs-pino';
import * as Sentry from '@sentry/nestjs';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './chat/redis-io.adapter';
import { MetricsService } from './monitoring/metrics.service';

function validateEnv() {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  const warnings: string[] = [];
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    warnings.push(
      'DATABASE_URL or DB_HOST not set — database connection may fail',
    );
  }
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    warnings.push(
      'REDIS_URL or REDIS_HOST not set — OTP/caching features will fail',
    );
  }
  if (!process.env.OTP_MOCK_CODE) {
    warnings.push('OTP_MOCK_CODE not set — defaulting to 123456 in mock mode');
  }
  if (!process.env.CORS_ALLOWED_ORIGINS) {
    warnings.push(
      'CORS_ALLOWED_ORIGINS is not set — only localhost/LAN origins allowed in dev',
    );
  }
  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[Env Validation] ${w}`);
    }
  }
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || undefined,
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1',
    ),
  });
}

validateEnv();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  // Use Pino logger
  app.useLogger(app.get(Logger));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const traceId =
      (req.headers['x-trace-id'] as string) || crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (req as any).traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);
    if (process.env.SENTRY_DSN) {
      try {
        Sentry.setTag('traceId', traceId);
      } catch {
        // best-effort
      }
    }
    next();
  });

  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads', 'chat');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix(process.env.API_PREFIX || '/api/v1');

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
            'https://cdn.jsdelivr.net',
          ],
          fontSrc: [
            "'self'",
            'https://fonts.gstatic.com',
            'https://cdn.jsdelivr.net',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'http://localhost:3000',
            'http://192.168.*:*',
            'http://172.20.*:*',
            'http://172.28.*:*',
          ],
          connectSrc: [
            "'self'",
            'http://localhost:*',
            'https://localhost:*',
            'ws://localhost:*',
            'wss://localhost:*',
            'http://192.168.*:*',
            'ws://192.168.*:*',
            'http://172.20.*:*',
            'ws://172.20.*:*',
            'http://172.28.*:*',
            'ws://172.28.*:*',
          ],
        },
      },
      frameguard: { action: 'deny' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'same-origin' },
      xPoweredBy: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isDev = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) return callback(null, true);

      // Allow explicitly listed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // In development, allow any localhost, LAN (192.168.*), or 127.0.0.1 origin
      if (isDev) {
        try {
          const url = new URL(origin);
          const host = url.hostname;
          if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host.startsWith('192.168.') ||
            host.startsWith('172.20.') ||
            host.startsWith('172.28.')
          ) {
            return callback(null, true);
          }
        } catch {
          // Invalid URL, deny
        }
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cache-Control',
      'Pragma',
    ],
    credentials: true,
  });

  if (isDev && allowedOrigins.length === 0) {
    app
      .get(Logger)
      .warn(
        'CORS_ALLOWED_ORIGINS is not set. All localhost and LAN origins are allowed in development.',
      );
  }

  const config = new DocumentBuilder()
    .setTitle('DesiCompany API')
    .setDescription('DesiCompany backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  if (process.env.NODE_ENV === 'production') {
    const adminDist = join(process.cwd(), '..', 'adminweb', 'dist');
    if (existsSync(adminDist)) {
      app.useStaticAssets(adminDist);
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (
          !req.path.startsWith('/api/') &&
          !req.path.startsWith('/uploads/')
        ) {
          res.sendFile(join(adminDist, 'index.html'));
        } else {
          next();
        }
      });
    }
  }

  const redisRequired = process.env.REDIS_REQUIRED === 'true';
  if (redisRequired) {
    app.get(Logger).log('Redis is REQUIRED in this environment');
  }
  app.useWebSocketAdapter(new RedisIoAdapter(app, redisRequired));

  await app.listen(process.env.PORT ?? 3000);

  const metrics = app.get(MetricsService);
  if (app.get(DataSource)) {
    metrics.startDbPoolPolling(app.get(DataSource), 5000);
  }

  app
    .get(Logger)
    .log(
      `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
    );
}
bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
