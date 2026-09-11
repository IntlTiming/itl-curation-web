import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';

@Module({
  // PassportModule.register is needed here (not just in EventsModule) so JwtAuthGuard can
  // resolve its AuthModuleOptions dependency within this module's own DI scope - mirrors
  // the same registration in events.module.ts.
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
