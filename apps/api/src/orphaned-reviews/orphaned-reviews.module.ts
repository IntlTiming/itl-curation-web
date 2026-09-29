import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { OrphanedReviewsController } from './orphaned-reviews.controller.js';
import { OrphanedReviewsService } from './orphaned-reviews.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its AuthModuleOptions
  // dependency within this module's own DI scope (see curators.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [OrphanedReviewsController],
  providers: [OrphanedReviewsService],
})
export class OrphanedReviewsModule {}
