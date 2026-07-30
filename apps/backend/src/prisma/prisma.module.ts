import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so any feature module can inject `PrismaService` without each one
 * re-importing this module. Not wired into the placeholder Auth/Household/
 * Child/Event modules yet — that starts once they get real logic.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
