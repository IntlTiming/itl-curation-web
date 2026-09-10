import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [PassportModule.register({ session: false })],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
