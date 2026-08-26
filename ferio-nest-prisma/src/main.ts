import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Import global filters, interceptors, guards //
import {
  createCorrelationId,
  HttpExceptionFilter,
  LoggingInterceptor,
  runWithCorrelationId,
  sanitizeLogText,
  TransformResponseInterceptor,
} from '@app/common';

// Import security packages
import helmet from 'helmet';
import compression from 'compression';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';

/**
 * Main Application Bootstrap
 *
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 *
 * Features:
 * ✅ Global pipes (validation)
 * ✅ Global filters (exception handling)
 * ✅ Global interceptors (transform, logging)
 * ✅ Security (Helmet, CORS)
 * ✅ Compression
 * ✅ Swagger documentation
 * ✅ Graceful shutdown
 * ✅ Socket.IO integration ⭐
 * ✅ BullMQ workers ⭐
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 6733);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const customerWebUrl = configService.get<string>(
    'CUSTOMER_WEB_URL',
    'http://localhost:3000',
  );
  const adminWebUrl = configService.get<string>(
    'ADMIN_WEB_URL',
    'http://localhost:3001',
  );

  // ────────────────────────────────────────────────────────────────────────
  // Security
  // ────────────────────────────────────────────────────────────────────────

  app.use((request: Request, response: Response, next: NextFunction) => {
    const correlationId = createCorrelationId(
      request.headers['x-correlation-id'] ?? request.headers['x-request-id'],
    );
    response.setHeader('X-Correlation-ID', correlationId);
    runWithCorrelationId(correlationId, next);
  });

  // Helmet - Security headers
  app.use(helmet());

  // CORS - Cross-Origin Resource Sharing
  app.enableCors({
    origin: [customerWebUrl, adminWebUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Correlation-ID',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Correlation-ID',
    ],
  });

  // ────────────────────────────────────────────────────────────────────────
  // Compression
  // ────────────────────────────────────────────────────────────────────────

  // Gzip compression
  app.use(compression());

  // ────────────────────────────────────────────────────────────────────────
  // Global Pipes
  // ────────────────────────────────────────────────────────────────────────

  // Validation pipe - validates all incoming requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if extra properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // ────────────────────────────────────────────────────────────────────────
  // Global Filters
  // ────────────────────────────────────────────────────────────────────────

  // HTTP exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // ────────────────────────────────────────────────────────────────────────
  // Global Interceptors
  // ────────────────────────────────────────────────────────────────────────

  // Transform response interceptor
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // Logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ────────────────────────────────────────────────────────────────────────
  // API Prefix
  // ────────────────────────────────────────────────────────────────────────

  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/socket.io', '/socket.io/(.*)'],
  });

  // ────────────────────────────────────────────────────────────────────────
  // Local Storage Driver — serve uploaded files at /uploads (§13)
  //
  // Only listing images are exposed directly. Private objects are served by
  // StorageController through short-lived, authorization-issued URLs.
  // ────────────────────────────────────────────────────────────────────────

  if (process.env.STORAGE_DRIVER !== 's3') {
    const express = require('express');
    const path = require('path');
    const localDir =
      process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'storage-uploads');

    app.getHttpAdapter().getInstance().use('/uploads', (req: any, res: any, next: any) => {
      const key = decodeURIComponent(String(req.path || '')).replace(/^\/+/, '');

      // Public prefix: listing photos / room photos / promo creatives.
      if (key.startsWith('images/') && req.method === 'GET') {
        return express.static(localDir, { maxAge: '30d' })(req, res, next);
      }

      return res.status(404).json({ message: 'Private object not found' });
    });
    logger.log('💾 Serving public images from /uploads; private objects require signed links');
  }

  // ── P0 boot guard: production must never run the mock payment driver ──
  const gatewayDriver = process.env.PAYMENT_GATEWAY_DRIVER || 'mock';
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (gatewayDriver === 'mock') {
      logger.error('🛑 BOOT REFUSED: PAYMENT_GATEWAY_DRIVER=mock in production.');
      logger.error('   Set it to bkash|sslcommerz|aamarpay|shurjopay with credentials.');
      process.exit(1);
    }
    logger.log('💳 Payment driver (production):', gatewayDriver);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Swagger Documentation
  // ────────────────────────────────────────────────────────────────────────

  if (nodeEnv === 'development' || nodeEnv === 'production') {
    const config = new DocumentBuilder()
      .setTitle('Ferio Commerce API')
      .setDescription('Ferio modular NestJS backend with PostgreSQL and Prisma')
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      })
      .addTag('Authentication', 'User authentication endpoints')
      .addTag('Users', 'User management endpoints')
      // .addTag('Tasks', 'Task management endpoints')
      // .addTag('Children Business User', 'Parent-child relationship management')
      .addTag('Settings', 'Store settings endpoints')
      .addTag('Catalog', 'Published customer catalog endpoints')
      .addTag('Admin Catalog', 'Protected catalog and inventory operations')
      .addTag('Cart', 'Persistent guest cart and server revalidation')
      .addTag('Checkout', 'Delivery pricing and recoverable checkout drafts')
      .addTag('Orders', 'Idempotent COD order placement')
      .addTag('Admin Orders', 'Protected COD verification and order operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Graceful Shutdown
  // ────────────────────────────────────────────────────────────────────────

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Handle process termination
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM signal received: closing HTTP server');
    await app.close();
    logger.log('HTTP server closed');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT signal received: closing HTTP server');
    await app.close();
    logger.log('HTTP server closed');
    process.exit(0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Start Application
  // ────────────────────────────────────────────────────────────────────────

  const socketPort = configService.get<number>('SOCKET_PORT', 6734);

  await app.listen(port, '0.0.0.0'); // for react native

  logger.log(`🚀 REST Backend HTTP server started on port ${port}`);
  logger.log(`⚡ Socket.IO Gateway server running on port ${socketPort}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`📡 API Prefix: ${apiPrefix}`);
  logger.log(`🔗 API URL: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🛍️ Customer Web: ${customerWebUrl}`);
  logger.log(`🧭 Admin Web: ${adminWebUrl}`);
}

// Bootstrap the application
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Failed to start application: ${sanitizeLogText(error)}`);
  process.exit(1);
});
