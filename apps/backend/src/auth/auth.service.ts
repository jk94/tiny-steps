import { randomBytes } from 'crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_MS } from '../config/jwt.config';
import type { JwtSecrets } from '../config/jwt.config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JWT_SECRETS } from './jwt-secrets.token';
import { toAuthenticatedUser } from './to-authenticated-user';
import type { AuthenticatedUser } from './types/authenticated-request';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthenticatedUser;
  tokens: TokenPair;
}

interface AccessTokenPayload {
  sub: string;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';

/** Prisma's unique-constraint-violation error code (see docs.prisma.io). */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class AuthService {
  /**
   * Precomputed once at startup and awaited (never recomputed) whenever
   * `login()` doesn't find a matching user, so `argon2.verify()` always
   * runs against *some* hash — keeping the response-time profile identical
   * for "no such user" and "wrong password" and avoiding a user-enumeration
   * timing side channel.
   */
  private readonly dummyPasswordHash: Promise<string> = argon2.hash(
    randomBytes(32).toString('hex'),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(JWT_SECRETS) private readonly jwtSecrets: JwtSecrets,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await argon2.hash(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }

    return this.issueSessionFor(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const hashToVerify = user?.passwordHash ?? (await this.dummyPasswordHash);

    // Always call argon2.verify(), even for a nonexistent user or an
    // OIDC-only account without a passwordHash — see `dummyPasswordHash`.
    const passwordValid = await argon2.verify(hashToVerify, dto.password).catch(() => false);

    if (!user || !user.passwordHash || !passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.issueSessionFor(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const tokenRow = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });

    if (!tokenRow || tokenRow.userId !== payload.sub) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (tokenRow.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    // Atomically consume the token: the WHERE clause only matches (and thus
    // only revokes) a row that's still unrevoked at the moment of the
    // write. A separate read-then-write here would leave a race where two
    // concurrent requests both read `revokedAt: null` before either write
    // lands, letting both mint a new pair and never tripping reuse
    // detection.
    const rotationResult = await this.prisma.refreshToken.updateMany({
      where: { id: tokenRow.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (rotationResult.count !== 1) {
      // Someone else already consumed this token — either a concurrent
      // request (the race above) or genuine reuse of an already-rotated-out
      // token. Either way, treat it as a theft signal and revoke every
      // active session of this user as defense-in-depth.
      await this.revokeAllRefreshTokensForUser(tokenRow.userId);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({ where: { id: tokenRow.userId } });
    if (!user) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return this.issueSessionFor(user);
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      // No valid session to revoke — treat as already logged out.
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.jwtSecrets.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }
  }

  private async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Creates the `RefreshToken` row and signs both JWTs for `user`,
   * establishing a new session. The single reusable entry point for
   * "start a session for this now-resolved `User`" — shared by local-auth
   * `register`/`login`/`refresh` above and, since this is the OIDC
   * sub-step, `OidcService`'s callback handler as well (see
   * `auth/oidc/oidc.service.ts`). Not `private` so `OidcService` can call
   * it directly, producing byte-identical token/cookie behaviour for
   * OIDC-originated sessions as for local-auth ones.
   */
  async issueSessionFor(user: User): Promise<AuthResult> {
    const refreshTokenRow = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const accessTokenPayload: AccessTokenPayload = { sub: user.id };
    const refreshTokenPayload: RefreshTokenPayload = { sub: user.id, jti: refreshTokenRow.id };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.jwtSecrets.accessSecret,
        expiresIn: ACCESS_TOKEN_TTL,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.jwtSecrets.refreshSecret,
        expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
      }),
    ]);

    return {
      user: toAuthenticatedUser(user),
      tokens: { accessToken, refreshToken },
    };
  }

  /** Updates the user's display name — the one field `PATCH /auth/me` exposes. */
  async updateName(userId: string, name: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name } });
    return toAuthenticatedUser(user);
  }
}
