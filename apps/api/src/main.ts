import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { initializeFirebase } from './config/firebase.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Firebase Admin ────────────────────────────────────────────────────────
  initializeFirebase(config);
  logger.log('Firebase Admin SDK initialised');

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
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // keeps the token across page refreshes
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  logger.log(`📄 Swagger docs available at http://localhost:${config.get('port') ?? 3000}/api/docs`);

  // ── Listen ────────────────────────────────────────────────────────────────
  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  logger.log(`🚀 MyHoodora API is running on http://localhost:${port}/api`);
}

bootstrap();

