import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { BasicCheckReasonsController } from './basic-check-reasons.controller.js';
import { BasicCheckReasonsService } from './basic-check-reasons.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its
  // AuthModuleOptions dependency within this module's own DI scope (see submissions.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [BasicCheckReasonsController],
  providers: [BasicCheckReasonsService],
})
export class BasicCheckReasonsModule {}
