import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { AlexaChildDirectory } from '../alexa-child-directory.service';
import { AlexaOAuthService } from '../oauth/alexa-oauth.service';

export interface AlexaLinkView {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** `null` when unset — or when the stored child is no longer reachable. */
  defaultChildId: string | null;
}

export interface AlexaLinkChildView {
  id: string;
  name: string;
  householdName: string;
}

export interface AlexaLinksOverview {
  /** Whether this instance has Alexa configured at all (ALX-15). */
  enabled: boolean;
  links: AlexaLinkView[];
  /** Children the user may pick as default, across all their households. */
  children: AlexaLinkChildView[];
}

/**
 * The app-side management of a user's own Alexa links (ALX-12): list, pick a
 * default child, unlink. Strictly user-scoped — a link that belongs to someone
 * else is indistinguishable from a nonexistent one (404).
 */
@Injectable()
export class AlexaLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly childDirectory: AlexaChildDirectory,
    private readonly oauthService: AlexaOAuthService,
  ) {}

  async overview(userId: string): Promise<AlexaLinksOverview> {
    if (!this.configService.get('alexa', { infer: true })) {
      return { enabled: false, links: [], children: [] };
    }

    const [links, children] = await Promise.all([
      this.prisma.alexaAccountLink.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.childDirectory.listAccessibleChildren(userId),
    ]);
    const reachable = new Set(children.map((child) => child.id));

    return {
      enabled: true,
      links: links.map((link) => ({
        id: link.id,
        createdAt: link.createdAt.toISOString(),
        lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
        defaultChildId:
          link.defaultChildId && reachable.has(link.defaultChildId) ? link.defaultChildId : null,
      })),
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        householdName: child.householdName,
      })),
    };
  }

  async setDefaultChild(
    userId: string,
    linkId: string,
    defaultChildId: string | null,
  ): Promise<AlexaLinkView> {
    await this.findOwnLinkOrThrow(userId, linkId);
    if (defaultChildId !== null) {
      const child = await this.childDirectory.findAccessibleChild(userId, defaultChildId);
      if (!child) {
        throw new BadRequestException({ statusCode: 400, code: 'CHILD_NOT_ACCESSIBLE' });
      }
    }

    const updated = await this.prisma.alexaAccountLink.update({
      where: { id: linkId },
      data: { defaultChildId },
    });
    return {
      id: updated.id,
      createdAt: updated.createdAt.toISOString(),
      lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
      defaultChildId: updated.defaultChildId,
    };
  }

  /**
   * The voice path of `setDefaultChild` ("Setze Emma als Standardkind"). The
   * caller has already resolved the child from the user's reachable children,
   * and the link comes from the verified access token.
   */
  async setDefaultChildForLink(linkId: string, childId: string): Promise<void> {
    await this.prisma.alexaAccountLink.update({
      where: { id: linkId },
      data: { defaultChildId: childId },
    });
  }

  /** Unlinks immediately: the next voice request with this link's token gets "please link". */
  async revoke(userId: string, linkId: string): Promise<void> {
    await this.findOwnLinkOrThrow(userId, linkId);
    await this.oauthService.revokeLink(linkId);
  }

  private async findOwnLinkOrThrow(userId: string, linkId: string) {
    const link = await this.prisma.alexaAccountLink.findFirst({
      where: { id: linkId, userId, revokedAt: null },
    });
    if (!link) {
      throw new NotFoundException();
    }
    return link;
  }
}
