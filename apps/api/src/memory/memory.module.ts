import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { EventsModule } from '../events/events.module';
import { MemoryRepository } from './memory.repository';
import { MemoryService } from './memory.service';
import { MemoryRetrievalService } from './memory-retrieval.service';
import { MemoryWorkerService } from './memory-worker.service';
import { MemoryController } from './memory.controller';

@Module({
  imports: [DatabaseModule, AiModule, EventsModule],
  controllers: [MemoryController],
  providers: [MemoryRepository, MemoryService, MemoryRetrievalService, MemoryWorkerService],
  exports: [MemoryRepository, MemoryService, MemoryRetrievalService, MemoryWorkerService],
})
export class MemoryModule {}
