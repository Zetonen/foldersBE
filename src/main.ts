import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: config
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Share-Token'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Data Room API')
    .setDescription('Virtual data room backend: rooms, folders, files, sharing')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addApiKey({ type: 'apiKey', name: 'X-Share-Token', in: 'header' }, 'share-token')
    .addCookieAuth('refresh_token')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(`Data Room API listening on port ${port} — docs at /api/docs`);
}

void bootstrap();
