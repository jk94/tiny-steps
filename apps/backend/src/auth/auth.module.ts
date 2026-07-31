import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { resolveJwtSecrets } from '../config/jwt.config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthEnabledGuard } from './guards/local-auth-enabled.guard';
import { JWT_SECRETS } from './jwt-secrets.token';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    // Registered with no default secret — AuthService/JwtStrategy pass
    // `{ secret, expiresIn }` explicitly per call, so this one shared
    // JwtService signs/verifies both access and refresh tokens with their
    // own respective secrets (see `config/jwt.config.ts`).
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    LocalAuthEnabledGuard,
    CsrfGuard,
    // Throws synchronously if either secret is unset, so the app fails to
    // bootstrap (fail-fast) rather than starting up with broken auth.
    { provide: JWT_SECRETS, useFactory: resolveJwtSecrets },
  ],
  exports: [JwtAuthGuard, CsrfGuard],
})
export class AuthModule {}
