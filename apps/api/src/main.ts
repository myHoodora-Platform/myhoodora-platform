import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { initializeFirebase } from './config/firebase.config';
import { API_DESCRIPTION, API_TAGS, ErrorResponse } from './shared/http/api-docs';

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
  // Off in production unless SWAGGER_ENABLED=true (the spec reveals every route, not secrets).
  const swaggerOn = config.get<string>('nodeEnv') !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerOn) {
    const builder = new DocumentBuilder()
      .setTitle('myHoodora API')
      .setDescription(API_DESCRIPTION)
      .setVersion('2.0')
      .setContact('myHoodora', 'https://myhoodora.com', 'hello@myhoodora.com')
      .addServer('/', 'This server')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token', description: 'Firebase ID token from the web/mobile SDK (user.getIdToken())' },
        'firebase-jwt', // reference name used in @ApiBearerAuth('firebase-jwt')
      );
    for (const [name, description] of API_TAGS) builder.addTag(name, description);
    const document = SwaggerModule.createDocument(app, builder.build(), { extraModels: [ErrorResponse] });
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'myHoodora API',
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: {
        persistAuthorization: true, // keeps the token across page refreshes
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
      },
    });
  }
  const port = config.get<number>('port') ?? 3000;

  // ── Listen ────────────────────────────────────────────────────────────────
  // Uploads up to 100 MB on slow mobile data can take many minutes; Node's default cuts requests at 5.
  // Headers must still arrive quickly (headersTimeout), so slow-header attacks stay blocked.
  (app.getHttpServer() as import("node:http").Server).requestTimeout = 20 * 60_000;
    await app.listen(port);
  logger.log(`MyHoodora API is running on http://localhost:${port}/api`);
}

bootstrap();

