import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent, NewProactiveCandidate } from '../../database/schema';
import { CandidateUrgency } from '@niva/shared-types';

@Injectable()
export class ProactiveCandidateGenerator {
  private readonly logger = new Logger(ProactiveCandidateGenerator.name);

  /**
   * Generates a Proactive Candidate from a domain event if warranted.
   * Returns null if the event is purely observational and warrants no candidate.
   */
  generateCandidate(event: DomainEvent): NewProactiveCandidate | null {
    const payload = (event.payload as Record<string, any>) || {};
    const userId = event.userId;
    const eventId = event.id;

    switch (event.eventType) {
      case 'TaskPostponed': {
        const title = String(payload.title || 'Task');
        const postponementCount = Number(payload.postponementCount || 1);
        const urgency: CandidateUrgency = postponementCount >= 2 ? 'high' : 'medium';
        const importance = postponementCount >= 2 ? 8 : 6;

        return {
          userId,
          eventId,
          candidateType: 'task_postponed_checkin',
          topic: title,
          urgency,
          importance,
          contextSnapshot: {
            taskId: payload.taskId,
            title,
            previousDueDate: payload.previousDueDate,
            newDueDate: payload.newDueDate,
            postponementCount,
          },
          status: 'pending',
        };
      }

      case 'CommitmentCreated':
      case 'CommitmentUpdated': {
        const title = String(payload.title || 'Commitment');
        const importanceLevel = String(payload.importance || 'standard');
        const urgency: CandidateUrgency = importanceLevel === 'critical' ? 'high' : 'medium';
        const importanceScore = importanceLevel === 'critical' ? 8 : 6;

        return {
          userId,
          eventId,
          candidateType: 'commitment_reminder',
          topic: title,
          urgency,
          importance: importanceScore,
          contextSnapshot: {
            commitmentId: payload.commitmentId,
            title,
            commitmentType: payload.commitmentType,
            dueAt: payload.dueAt || payload.newDueAt,
            importance: importanceLevel,
          },
          status: 'pending',
        };
      }

      case 'TaskCompleted': {
        const title = String(payload.title || 'Task');
        return {
          userId,
          eventId,
          candidateType: 'celebrate_task_completed',
          topic: title,
          urgency: 'low',
          importance: 5,
          contextSnapshot: {
            taskId: payload.taskId,
            title,
            completedAt: payload.completedAt,
          },
          status: 'pending',
        };
      }

      case 'MemoryAccepted':
      case 'MemorySuperseded':
        // Memory events are cognitive signals for future dialogues; they do NOT trigger proactive notifications
        this.logger.debug(`Cognitive event ${event.eventType} recorded; no proactive candidate generated.`);
        return null;

      case 'UserMessageSent':
      case 'TaskCreated':
      default:
        return null;
    }
  }
}
