import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { initializeFirebase } from './config/firebase.config';

async function bootstrap() {
  // rawBody: webhook signatures (Resend/Svix) must be verified on the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Firebase Admin ────────────────────────────────────────────────────────
  initializeFirebase(config);
  logger.log('Firebase Admin SDK initialised');

  // Behind a hosting proxy, use the client IP for rate limits.
  if (config.get<string>('nodeEnv') === 'production') app.set('trust proxy', 1);

  // ── Global pipes ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: config.get<string>('cors.origin'),
    credentials: true,
  });

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Swagger ───────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MyHoodora API')
    .setDescription(
      'Hyper-local social platform — REST API documentation.\n\n' +
      'All protected routes require a valid **Firebase ID token** passed as:\n' +
      '`Authorization: Bearer <idToken>`',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID Token',
        name: 'Authorization',
        in: 'header',
      },
      'firebase-jwt', // reference name used in @ApiBearerAuth('firebase-jwt')
    )
    .addTag('health', 'Service health & readiness')
    .addTag('auth', 'Firebase authentication helpers')
    .addTag('users', 'User profile management')
    .addTag('posts', 'Neighbourhood posts & feed')
    .addTag('neighborhoods', 'Neighbourhood discovery & geo-search')
    .addTag('comments', 'Comments')
    .addTag('notifications', 'In-app notifications')
    .addTag('reports', 'Reporting content & people')
    .addTag('admin', 'Staff operations (contract §13)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // API docs are for development; not exposed in production.
  if (config.get<string>('nodeEnv') !== 'production') SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // keeps the token across page refreshes
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  const port = config.get<number>('port') ?? 3000;

  // ── Listen ────────────────────────────────────────────────────────────────
    await app.listen(port);
  logger.log(`MyHoodora API is running on http://localhost:${port}/api`);
}

bootstrap();

