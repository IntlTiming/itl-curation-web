import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export type DiscordProfile = {
  id: string;
  username: string;
  avatar: string | null;
};

@Injectable()
export class AuthService {
  private readonly adminIds: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.adminIds = new Set(
      (this.config.get<string>('GLOBAL_ADMIN_DISCORD_IDS') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  async loginWithDiscord(profile: DiscordProfile) {
    const isEnvAdmin = this.adminIds.has(profile.id);

    const user = await this.prisma.user.upsert({
      where: { discordId: profile.id },
      create: {
        discordId: profile.id,
        discordUsername: profile.username,
        discordAvatarHash: profile.avatar,
        isGlobalAdmin: isEnvAdmin,
        lastLoginAt: new Date(),
      },
      update: {
        discordUsername: profile.username,
        discordAvatarHash: profile.avatar,
        // Only ever grant, never revoke, based on the env list - an admin
        // manually granted some other way (future admin UI) isn't clobbered
        // by omission from this list.
        isGlobalAdmin: isEnvAdmin ? true : undefined,
        lastLoginAt: new Date(),
      },
    });

    const token = await this.jwt.signAsync({ sub: user.id });
    return { user, token };
  }

  async validateUserId(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
