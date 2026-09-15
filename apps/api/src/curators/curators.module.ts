import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsModule } from '../events/events.module.js';
import { CuratorsController } from './curators.controller.js';
import { CuratorsService } from './curators.service.js';

@Module({
  // PassportModule.register is needed here so JwtAuthGuard can resolve its
  // AuthModuleOptions dependency within this module's own DI scope (see import.module.ts).
  imports: [PassportModule.register({ session: false }), EventsModule],
  controllers: [CuratorsController],
  providers: [CuratorsService],
})
export class CuratorsModule {}
