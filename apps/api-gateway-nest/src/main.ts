// apps/api-gateway-nest/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { startTracing } from './common/observability/tracing';
import { startMetrics } from './common/observability/metrics';
import { LoggingInterceptor } from './common/observability/logging.interceptor';

async function bootstrap() {
  // Start OpenTelemetry before app creation
  await startTracing();
  await startMetrics();

  // Use HTTPS in production when TLS paths are provided
  const httpsOptions =
    process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH
      ? {
          key: fs.readFileSync(process.env.TLS_KEY_PATH),
          cert: fs.readFileSync(process.env.TLS_CERT_PATH),
        }
      : undefined;

  const app = await NestFactory.create(AppModule, { httpsOptions });

  // Global validation pipe — strips unknown props, transforms DTOs
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Global logging interceptor for request duration tracking
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Jarvis API Gateway running on port ${port}`);
}

bootstrap();
