import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its
  // AuthModuleOptions dependency within this module's own DI scope (see submissions.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
