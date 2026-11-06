import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { ContextModule } from '../context/context.module';
import { AiModule } from '../ai/ai.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { MemoryModule } from '../memory/memory.module';
import { ConversationRepository } from '../conversation/conversation.repository';
import { BehavioralSignalsService } from './behavioral-signals.service';
import { CompanionOrchestratorService } from './companion-orchestrator.service';
import { ProactiveCandidateGenerator } from '../events/proactive/proactive-candidate.generator';
import { ProactivePolicyService } from '../events/proactive/proactive-policy.service';
import { ProactiveMessageService } from '../events/proactive/proactive-message.service';
import { ProactiveDeliveryService } from '../events/proactive/proactive-delivery.service';
import { NotificationIntelligenceService } from '../events/proactive/notification-intelligence.service';
import { EventProcessorService } from '../events/event-processor.service';
import { ProactiveService } from '../events/proactive/proactive.service';
import { ProactiveController } from '../events/proactive/proactive.controller';
import { EventsController } from '../events/events.controller';

import { ConversationActionService } from './conversation-action.service';
import { LifeContextModule } from '../life-context/life-context.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    ContextModule,
    AiModule,
    PersonalizationModule,
    MemoryModule,
    LifeContextModule,
    JobsModule,
    NotificationsModule,
  ],
  controllers: [EventsController, ProactiveController],
  providers: [
    ConversationRepository,
    BehavioralSignalsService,
    ConversationActionService,
    CompanionOrchestratorService,
    ProactiveCandidateGenerator,
    ProactivePolicyService,
    ProactiveMessageService,
    ProactiveDeliveryService,
    NotificationIntelligenceService,
    EventProcessorService,
    ProactiveService,
  ],
  exports: [
    CompanionOrchestratorService,
    ConversationActionService,
    BehavioralSignalsService,
    EventProcessorService,
    ProactiveService,
    ProactivePolicyService,
    ProactiveMessageService,
    ProactiveDeliveryService,
    NotificationIntelligenceService,
  ],
})
export class OrchestrationModule {}
