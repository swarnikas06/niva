import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventRepository } from './event.repository';
import { EventPublisherService } from './event-publisher.service';

@Module({
  imports: [DatabaseModule],
  providers: [EventRepository, EventPublisherService],
  exports: [EventRepository, EventPublisherService],
})
export class EventsModule {}
