import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Logger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  // Use Pino logger
  app.useLogger(app.get(Logger));

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
          imgSrc: ["'self'", 'data:', 'blob:', 'http://localhost:3000', 'http://192.168.*:*'],
          connectSrc: ["'self'", "http://localhost:*", "https://localhost:*", "ws://localhost:*", "wss://localhost:*", "http://192.168.*:*", "ws://192.168.*:*"],
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

  app.useGlobalFilters(new AllExceptionsFilter());

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length > 0) {
    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
    });
  } else if (process.env.NODE_ENV === 'production') {
    app
      .get(Logger)
      .warn(
        'CORS_ALLOWED_ORIGINS is not set. CORS will deny all origins in production.',
      );
  } else {
    // Dev: allow all origins
    app.enableCors({ origin: true, credentials: true });
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

  await app.listen(process.env.PORT ?? 3000);
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
