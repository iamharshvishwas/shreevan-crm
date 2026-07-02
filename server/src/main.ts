import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

async function bootstrap(): Promise<void> {
  // rawBody: true exposes req.rawBody so we can verify Meta's X-Hub-Signature-256.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);

  app.use(helmet());
  // CRM origin uses credentials (JWT). Marketing-site origins are allowed too so the
  // public Veda chat widget can call /chat/message (no credentials needed there).
  const crmOrigin = config.get<string>('CORS_ORIGIN')!;
  const siteOrigins = (config.get<string>('PUBLIC_SITE_ORIGIN') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const allowedOrigins = new Set([crmOrigin, ...siteOrigins]);
  app.enableCors({
    origin: (origin, cb) => {
      // Allow same-origin / server-to-server (no Origin header) and any allow-listed origin.
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Shreevan Wellness CRM API')
    .setDescription('Internal CRM backend — enquiries, leads, pipeline, reports.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Shreevan CRM API on http://localhost:${port}/api/v1 — docs at /api/docs`);
}

void bootstrap();
