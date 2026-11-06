import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventRepository } from './event.repository';
import { EventPublisherService } from './event-publisher.service';
import { ProactiveCandidateGenerator } from './proactive/proactive-candidate.generator';
import { CompanionOrchestratorService } from '../orchestration/companion-orchestrator.service';
import { ProcessEventsResultDto } from '@niva/shared-types';

@Injectable()
export class EventProcessorService implements OnModuleInit {
  private readonly logger = new Logger(EventProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly repository: EventRepository,
    private readonly publisher: EventPublisherService,
    private readonly candidateGenerator: ProactiveCandidateGenerator,
    private readonly companionOrchestrator: CompanionOrchestratorService,
  ) {}

  onModuleInit() {
    // Register asynchronous processing hook with EventPublisherService
    this.publisher.registerProcessorHook(async (_eventId?: string) => {
      await this.processBatch(10);
    });
    this.logger.log('EventProcessorService initialized and hooked to EventPublisherService');
  }

  /**
   * Processes a batch of pending or retryable domain events.
   * Concurrency-safe via atomic FOR UPDATE SKIP LOCKED.
   */
  async processBatch(limit = 20): Promise<ProcessEventsResultDto> {
    if (this.isProcessing) {
      this.logger.debug('Batch processing already active, skipping concurrent pass');
      return {
        eventsClaimed: 0,
        eventsProcessed: 0,
        eventsFailed: 0,
        candidatesGenerated: 0,
        actionsDelivered: 0,
      };
    }

    this.isProcessing = true;
    let processedCount = 0;
    let failedCount = 0;
    let candidatesGenerated = 0;
    let actionsDelivered = 0;

    try {
      const claimedEvents = await this.repository.claimPendingEvents(limit);
      if (claimedEvents.length === 0) {
        return {
          eventsClaimed: 0,
          eventsProcessed: 0,
          eventsFailed: 0,
          candidatesGenerated: 0,
          actionsDelivered: 0,
        };
      }

      this.logger.log(`Claimed ${claimedEvents.length} events for processing`);

      for (const event of claimedEvents) {
        try {
          // 1. Candidate Generation
          const candidateData = this.candidateGenerator.generateCandidate(event);

          if (candidateData) {
            candidatesGenerated++;
            const candidate = await this.repository.createCandidate(candidateData);

            // 2. Fetch or initialize user proactive preferences
            let preferences = await this.repository.getUserPreferences(event.userId);
            if (!preferences) {
              preferences = await this.repository.upsertUserPreferences(event.userId, {
                proactiveEnabled: true,
                quietHoursEnabled: true,
                quietHoursStart: '22:00',
                quietHoursEnd: '08:00',
                timezone: 'UTC',
                maxDailyInteractions: 3,
                allowHighUrgencyInQuietHours: false,
              });
            }

            // 3. Delegate to central Companion Orchestrator (Phase 5)
            const decision = await this.companionOrchestrator.orchestrateProactiveIntervention(
              {
                source: 'proactive_evaluation',
                userId: event.userId,
                eventId: event.id,
              },
              candidate,
              preferences,
            );

            this.logger.log(
              `[Orchestration Decision] Candidate ${candidate.id} (${candidate.topic}): ${decision.decision} (${decision.mode}) - ${decision.rationale}`,
            );

            if (decision.decision === 'proactive' && decision.interventionWarranted) {
              actionsDelivered++;
            } else if (decision.decision === 'defer') {
              // Update candidate as deferred
              await this.repository.updateCandidate(candidate.id, {
                status: 'pending',
                decision: 'DEFER',
                decisionReason: decision.rationale,
                evaluatedAt: new Date(),
              });
            } else {
              // NO_ACTION -> discarded
              await this.repository.updateCandidate(candidate.id, {
                status: 'discarded',
                decision: 'NO_ACTION',
                decisionReason: decision.rationale,
                evaluatedAt: new Date(),
              });
            }
          }

          // 5. Mark event as successfully processed
          await this.repository.markEventProcessed(event.id);
          processedCount++;
        } catch (err: any) {
          failedCount++;
          this.logger.error(`Error processing event ${event.id}:`, err);
          await this.repository.markEventFailed(event.id, err?.message || 'Unknown processing error');
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return {
      eventsClaimed: processedCount + failedCount,
      eventsProcessed: processedCount,
      eventsFailed: failedCount,
      candidatesGenerated,
      actionsDelivered,
    };
  }
}
