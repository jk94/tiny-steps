import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HouseholdModule } from './household/household.module';
import { ChildModule } from './child/child.module';
import { EventModule } from './event/event.module';
import { FeedingModule } from './feeding/feeding.module';
import { SleepModule } from './sleep/sleep.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import loadConfiguration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfiguration],
    }),
    // Serves the built React SPA (copied into dist/public by the Docker
    // build, see the root Dockerfile) with client-side routing fallback.
    // `/api/**` and `/health` are excluded so they reach the Nest
    // controllers below instead of falling through to `index.html`.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api/{*splat}', '/health'],
    }),
    PrismaModule,
    AuthModule,
    HouseholdModule,
    ChildModule,
    EventModule,
    FeedingModule,
    SleepModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
