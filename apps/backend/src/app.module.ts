import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HouseholdModule } from './household/household.module';
import { ChildModule } from './child/child.module';
import { EventModule } from './event/event.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule, EventModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
