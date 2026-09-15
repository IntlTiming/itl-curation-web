import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its
  // AuthModuleOptions dependency within this module's own DI scope (see reviews.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
