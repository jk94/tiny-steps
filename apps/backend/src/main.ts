import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API routes live under /api so the SPA (served by ServeStaticModule, see
  // app.module.ts) can own every other path, including "/". `/health` stays
  // unprefixed for simple container/orchestrator health checks.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const configService = app.get(ConfigService<AppConfig, true>);
  await app.listen(configService.get('server.port', { infer: true }));
}
bootstrap();
