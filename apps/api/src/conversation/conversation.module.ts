import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { ConversationRepository } from './conversation.repository';
import { DatabaseModule } from '../database/database.module';
import { ContextModule } from '../context/context.module';
import { AiModule } from '../ai/ai.module';
import { EventsModule } from '../events/events.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';

@Module({
  imports: [
    DatabaseModule,
    ContextModule,
    AiModule,
    EventsModule,
    OrchestrationModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationRepository],
  exports: [ConversationService, ConversationRepository],
})
export class ConversationModule {}


