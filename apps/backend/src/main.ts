import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API routes live under /api so the SPA (served by ServeStaticModule, see
  // app.module.ts) can own every other path, including "/". `/health` stays
  // unprefixed for simple container/orchestrator health checks.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Required to read the httpOnly access/refresh/csrf cookies set by
  // AuthController (see src/auth/auth.controller.ts).
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Deliberately NOT calling app.enableCors(): the single container serves
  // both the API and the SPA from the same origin (see ServeStaticModule in
  // app.module.ts), so no cross-origin requests need to be allowed. This is
  // part of this app's CSRF mitigation for cookie-based JWTs, alongside
  // SameSite=Lax cookies and the double-submit CsrfGuard (see
  // src/auth/guards/csrf.guard.ts).

  const configService = app.get(ConfigService<AppConfig, true>);
  await app.listen(configService.get('server.port', { infer: true }));
}
bootstrap();
