import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';

// Explicit runtime module references for Vercel serverless dependency tracing
import '@nestjs/jwt';
import '@nestjs/passport';
import 'passport';
import 'passport-jwt';
import 'pg';
import 'ioredis';
import 'drizzle-orm';
import 'drizzle-orm/node-postgres';
import 'google-auth-library';
import 'bcrypt';
import 'nodemailer';
import 'web-push';
import 'swagger-ui-express';

let cachedApp: INestApplication | null = null;
let expressInstance: any = null;

async function configureApp(app: INestApplication) {
  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const corsOrigins = configService.get<string>(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,https://niva-iota.vercel.app',
  );
  const cookieSecret = configService.get<string>(
    'COOKIE_SECRET',
    'niva_dev_cookie_secret_min_32_characters_here',
  );

  // Validate critical production secrets on boot
  if (isProd) {
    const jwtSecret = configService.get<string>('JWT_SECRET')?.trim();
    if (
      !jwtSecret ||
      jwtSecret === 'niva_dev_jwt_secret_min_32_characters_long' ||
      jwtSecret.length < 32
    ) {
      throw new Error(
        '[FATAL SECURITY MISCONFIGURATION] JWT_SECRET must be configured with a cryptographically secure value (minimum 32 characters) in production. Insecure default rejected.',
      );
    }

    const cookieSec = configService.get<string>('COOKIE_SECRET')?.trim();
    if (
      !cookieSec ||
      cookieSec === 'niva_dev_cookie_secret_min_32_characters_here' ||
      cookieSec.length < 32
    ) {
      throw new Error(
        '[FATAL SECURITY MISCONFIGURATION] COOKIE_SECRET must be configured with a cryptographically secure value (minimum 32 characters) in production. Insecure default rejected.',
      );
    }

    const internalSec = configService.get<string>('NIVA_INTERNAL_SECRET')?.trim();
    if (
      !internalSec ||
      internalSec === 'niva_internal_secret_change_in_production_32c' ||
      internalSec.length < 32
    ) {
      throw new Error(
        '[FATAL SECURITY MISCONFIGURATION] NIVA_INTERNAL_SECRET must be configured with a cryptographically secure value (minimum 32 characters) in production. Insecure default rejected.',
      );
    }
  }

  // Reverse Proxy Configuration
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // HTTP Security Headers
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProd) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }
    next();
  });

  // Cookie Parser Middleware
  app.use(cookieParser(cookieSecret));

  // Global API Versioning Prefix
  app.setGlobalPrefix('api/v1');

  // CORS Configuration
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      const allowed = corsOrigins.split(',').map((o) => o.trim()).filter(Boolean);
      if (allowed.includes(requestOrigin)) return callback(null, true);
      // Allow Vercel preview and deployment origins matching niva
      if (/^https:\/\/(niva[a-z0-9-]*|.*-code-54d6s-projects)\.vercel\.app$/.test(requestOrigin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    credentials: true,
  });

  // Global Interceptors and Filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger / OpenAPI 3.0 Documentation Setup (Development only or explicit opt-in)
  if (!isProd || configService.get<string>('ENABLE_SWAGGER') === 'true') {
    const port =
      configService.get<number>('PORT') ||
      configService.get<number>('API_PORT', 4000);
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NIVA API')
      .setDescription('NIVA Core Backend API specification')
      .setVersion('1.0')
      .addTag('Health', 'Service liveness and dependency readiness endpoints')
      .addTag('Authentication', 'User registration, login, session refresh, and OAuth endpoints')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
    const logger = new Logger('Bootstrap');
    logger.log(`📚 Swagger documentation available at: http://localhost:${port}/api-docs`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  await configureApp(app);

  const configService = app.get(ConfigService);
  const port =
    configService.get<number>('PORT') ||
    configService.get<number>('API_PORT', 4000);

  await app.listen(port);
  logger.log(`🚀 NIVA API is running on: http://localhost:${port}/api/v1`);
}

async function getOrCreateServerlessApp() {
  if (!cachedApp) {
    expressInstance = express();
    const adapter = new ExpressAdapter(expressInstance);
    cachedApp = await NestFactory.create(AppModule, adapter);
    await configureApp(cachedApp);
    await cachedApp.init();
  }
  return { app: cachedApp, expressInstance };
}

export default async function handler(req: Request, res: Response) {
  const { expressInstance } = await getOrCreateServerlessApp();
  return expressInstance(req, res);
}

if (!process.env.VERCEL) {
  bootstrap();
}
