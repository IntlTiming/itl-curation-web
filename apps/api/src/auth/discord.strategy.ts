import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';

// passport-discord and passport-discord-auth are both unmaintained/non-MIT,
// so this talks to Discord's OAuth2 + user endpoints directly on top of the
// generic (actively maintained) passport-oauth2 strategy.

type DiscordUser = {
  id: string;
  username: string;
  avatar: string | null;
};

@Injectable()
export class DiscordStrategy extends PassportStrategy(OAuth2Strategy, 'discord') {
  constructor(config: ConfigService) {
    super({
      authorizationURL: 'https://discord.com/api/oauth2/authorize',
      tokenURL: 'https://discord.com/api/oauth2/token',
      clientID: config.getOrThrow<string>('DISCORD_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('DISCORD_CALLBACK_URL'),
      scope: ['identify'],
    });
  }

  // OAuth2Strategy has no built-in notion of a user profile - override the
  // (no-op by default) hook to fetch one from Discord's API.
  userProfile(accessToken: string, done: (err?: Error | null, profile?: unknown) => void): void {
    fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Discord profile fetch failed: ${res.status}`);
        }
        return (await res.json()) as DiscordUser;
      })
      .then((profile) => done(null, profile))
      .catch((err: unknown) =>
        done(err instanceof Error ? err : new Error('Discord profile fetch failed')),
      );
  }

  validate(_accessToken: string, _refreshToken: string, profile: DiscordUser) {
    return {
      id: profile.id,
      username: profile.username,
      avatar: profile.avatar ?? null,
    };
  }
}
