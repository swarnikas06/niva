import { Test, TestingModule } from '@nestjs/testing';
import { EventProcessorService } from './event-processor.service';
import { EventRepository } from './event.repository';
import { EventPublisherService } from './event-publisher.service';
import { ProactiveCandidateGenerator } from './proactive/proactive-candidate.generator';
import { CompanionOrchestratorService } from '../orchestration/companion-orchestrator.service';
import { DomainEvent } from '../database/schema';

describe('EventProcessorService', () => {
  let service: EventProcessorService;
  let repository: Record<string, jest.Mock>;
  let publisher: Record<string, jest.Mock>;
  let candidateGenerator: Record<string, jest.Mock>;
  let companionOrchestrator: Record<string, jest.Mock>;

  const mockEvent: DomainEvent = {
    id: 'evt-1',
    userId: 'user-1',
    eventType: 'TaskPostponed',
    eventVersion: 1,
    aggregateType: 'task',
    aggregateId: 'task-1',
    payload: { title: 'File Taxes', postponementCount: 2 },
    occurredAt: new Date(),
    status: 'processing',
    retryCount: 0,
    maxRetries: 3,
    lastError: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCandidate = {
    id: 'cand-1',
    userId: 'user-1',
    eventId: 'evt-1',
    candidateType: 'task_postponed_checkin',
    topic: 'File Taxes',
    urgency: 'medium',
    importance: 6,
    contextSnapshot: {},
    status: 'pending',
    decision: null,
    decisionReason: null,
    createdAt: new Date(),
    evaluatedAt: null,
  };

  beforeEach(async () => {
    repository = {
      claimPendingEvents: jest.fn(),
      markEventProcessed: jest.fn().mockResolvedValue(null),
      markEventFailed: jest.fn().mockResolvedValue(null),
      createCandidate: jest.fn().mockResolvedValue(mockCandidate),
      getUserPreferences: jest.fn().mockResolvedValue(null),
      upsertUserPreferences: jest.fn().mockResolvedValue({
        userId: 'user-1',
        proactiveEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'UTC',
        maxDailyInteractions: 3,
        allowHighUrgencyInQuietHours: false,
      }),
      updateCandidate: jest.fn().mockResolvedValue(mockCandidate),
    };

    publisher = {
      registerProcessorHook: jest.fn(),
    };

    candidateGenerator = {
      generateCandidate: jest.fn(),
    };

    companionOrchestrator = {
      orchestrateProactiveIntervention: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        { provide: EventRepository, useValue: repository },
        { provide: EventPublisherService, useValue: publisher },
        { provide: ProactiveCandidateGenerator, useValue: candidateGenerator },
        { provide: CompanionOrchestratorService, useValue: companionOrchestrator },
      ],
    }).compile();

    service = module.get<EventProcessorService>(EventProcessorService);
  });

  it('claims events, generates candidate, executes orchestrator proactive decision, and delivers action', async () => {
    repository.claimPendingEvents.mockResolvedValue([mockEvent]);
    candidateGenerator.generateCandidate.mockReturnValue(mockCandidate);
    companionOrchestrator.orchestrateProactiveIntervention.mockResolvedValue({
      decision: 'proactive',
      mode: 'challenge',
      interventionWarranted: true,
      rationale: 'High urgency item requires companion nudge',
    });

    const result = await service.processBatch(10);

    expect(result.eventsClaimed).toBe(1);
    expect(result.eventsProcessed).toBe(1);
    expect(result.candidatesGenerated).toBe(1);
    expect(result.actionsDelivered).toBe(1);
    expect(companionOrchestrator.orchestrateProactiveIntervention).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'proactive_evaluation', userId: 'user-1' }),
      mockCandidate,
      expect.anything(),
    );
    expect(repository.markEventProcessed).toHaveBeenCalledWith('evt-1');
  });

  it('marks event processed without action when orchestrator decides NO_ACTION', async () => {
    repository.claimPendingEvents.mockResolvedValue([mockEvent]);
    candidateGenerator.generateCandidate.mockReturnValue(mockCandidate);
    companionOrchestrator.orchestrateProactiveIntervention.mockResolvedValue({
      decision: 'no_action',
      mode: 'silent',
      interventionWarranted: false,
      rationale: 'Quiet hours active',
    });

    const result = await service.processBatch(10);

    expect(result.eventsClaimed).toBe(1);
    expect(result.eventsProcessed).toBe(1);
    expect(result.actionsDelivered).toBe(0);
    expect(repository.updateCandidate).toHaveBeenCalledWith(
      'cand-1',
      expect.objectContaining({
        status: 'discarded',
        decision: 'NO_ACTION',
        decisionReason: 'Quiet hours active',
      }),
    );
    expect(repository.markEventProcessed).toHaveBeenCalledWith('evt-1');
  });
});

