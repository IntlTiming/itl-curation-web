import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { OrphanedReviewsModule } from '../orphaned-reviews/orphaned-reviews.module.js';
import { SuggestionCommentsService } from './suggestion-comments.service.js';
import { SuggestionLinksController, SuggestionsController } from './suggestions.controller.js';
import { SuggestionsService } from './suggestions.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its AuthModuleOptions
  // dependency within this module's own DI scope (see curators.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule, OrphanedReviewsModule],
  // Order matters: SuggestionLinksController's literal search-submissions route has to be
  // registered before SuggestionsController's GET :position.
  controllers: [SuggestionLinksController, SuggestionsController],
  providers: [SuggestionsService, SuggestionCommentsService],
})
export class SuggestionsModule {}
