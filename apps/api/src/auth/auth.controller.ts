import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService, type DiscordProfile } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { DiscordAuthGuard } from './discord-auth.guard.js';
import { UpdateDisplayNameDto } from './dto/update-display-name.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { SESSION_COOKIE_NAME } from './jwt.strategy.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  discordLogin() {
    // Guard redirects to Discord's consent screen; nothing to do here.
  }

  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  async discordCallback(@Req() req: Request, @Res() res: Response) {
    const { token } = await this.auth.loginWithDiscord(req.user as DiscordProfile);

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? '';
    res.redirect(`${webOrigin}/`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateDisplayNameDto) {
    return this.auth.updateDisplayName(user.id, dto.displayName);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.status(204).send();
  }
}
