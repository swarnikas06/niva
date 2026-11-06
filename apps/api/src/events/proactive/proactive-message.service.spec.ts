import { Test, TestingModule } from '@nestjs/testing';
import { ProactiveMessageService } from './proactive-message.service';
import { PersonalizationService } from '../../personalization/personalization.service';
import { ProactiveCandidate } from '../../database/schema';

describe('ProactiveMessageService', () => {
  let service: ProactiveMessageService;
  let personalizationService: Record<string, jest.Mock>;

  const baseCandidate: ProactiveCandidate = {
    id: 'cand-1',
    userId: 'user-1',
    eventId: 'event-1',
    candidateType: 'task_postponed_checkin',
    topic: 'Submit Quarterly Report',
    urgency: 'high',
    importance: 8,
    contextSnapshot: {
      title: 'Submit Quarterly Report',
      postponementCount: 3,
    },
    status: 'pending',
    decision: null,
    decisionReason: null,
    createdAt: new Date(),
    evaluatedAt: null,
  };

  beforeEach(async () => {
    personalizationService = {
      getPersonalization: jest.fn().mockResolvedValue({
        preferredName: 'Alex',
        selectedArchetypeId: 'niva_anchor',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProactiveMessageService,
        {
          provide: PersonalizationService,
          useValue: personalizationService,
        },
      ],
    }).compile();

    service = module.get<ProactiveMessageService>(ProactiveMessageService);
  });

  it('synthesizes warm, grounded message for niva_anchor archetype', async () => {
    const message = await service.synthesizeMessage(baseCandidate);
    expect(message.title).toBe('Task Check-in: Submit Quarterly Report');
    expect(message.content).toContain('Alex');
    expect(message.content).toContain('No stress at all');
  });

  it('synthesizes reflective, analytical message for niva_sage archetype', async () => {
    personalizationService.getPersonalization.mockResolvedValue({
      preferredName: 'Alex',
      selectedArchetypeId: 'niva_sage',
    });

    const message = await service.synthesizeMessage(baseCandidate);
    expect(message.content).toContain('Alex');
    expect(message.content).toContain('friction');
  });

  it('synthesizes energetic message for niva_spark archetype', async () => {
    personalizationService.getPersonalization.mockResolvedValue({
      preferredName: 'Alex',
      selectedArchetypeId: 'niva_spark',
    });

    const message = await service.synthesizeMessage(baseCandidate);
    expect(message.content).toContain('Alex');
    expect(message.content).toContain('bite-sized');
  });

  it('synthesizes direct, accountability message for niva_challenger archetype', async () => {
    personalizationService.getPersonalization.mockResolvedValue({
      preferredName: 'Alex',
      selectedArchetypeId: 'niva_challenger',
    });

    const message = await service.synthesizeMessage(baseCandidate);
    expect(message.content).toContain('Alex');
    expect(message.content).toContain('3 times now');
    expect(message.content).toContain('priority');
  });

  it('synthesizes commitment reminder appropriately', async () => {
    const commitmentCandidate: ProactiveCandidate = {
      ...baseCandidate,
      candidateType: 'commitment_reminder',
      topic: 'Client Review Meeting',
      contextSnapshot: { title: 'Client Review Meeting' },
    };

    const message = await service.synthesizeMessage(commitmentCandidate);
    expect(message.title).toBe('Commitment Reminder: Client Review Meeting');
    expect(message.content).toContain('radar');
  });

  it('synthesizes celebratory message on task completion', async () => {
    const completedCandidate: ProactiveCandidate = {
      ...baseCandidate,
      candidateType: 'celebrate_task_completed',
      topic: 'Deploy App',
      contextSnapshot: { title: 'Deploy App' },
    };

    const message = await service.synthesizeMessage(completedCandidate);
    expect(message.title).toBe('Task Completed: Deploy App');
    expect(message.content).toContain('is checked off');
  });
});
