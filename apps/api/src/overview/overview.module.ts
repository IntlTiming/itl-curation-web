import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its
  // AuthModuleOptions dependency within this module's own DI scope (see submissions.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
