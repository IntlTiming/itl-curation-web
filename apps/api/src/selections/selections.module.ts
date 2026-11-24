import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { SelectionsController } from './selections.controller.js';
import { SelectionsService } from './selections.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its
  // AuthModuleOptions dependency within this module's own DI scope (see submissions.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [SelectionsController],
  providers: [SelectionsService],
})
export class SelectionsModule {}
