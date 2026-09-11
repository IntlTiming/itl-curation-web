import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<Request & { user: User }>();
    if (!user?.isGlobalAdmin) {
      throw new ForbiddenException('Global admin access required');
    }
    return true;
  }
}
