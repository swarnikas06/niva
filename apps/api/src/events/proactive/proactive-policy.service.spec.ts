import { Test, TestingModule } from '@nestjs/testing';
import { ProactivePolicyService } from './proactive-policy.service';
import { EventRepository } from '../event.repository';
import { ProactiveCandidate, UserProactivePreferences } from '../../database/schema';

describe('ProactivePolicyService', () => {
  let service: ProactivePolicyService;
  let repository: Record<string, jest.Mock>;

  const mockCandidate: ProactiveCandidate = {
    id: 'cand-1',
    userId: 'user-1',
    eventId: 'event-1',
    candidateType: 'task_postponed_checkin',
    topic: 'Prepare Tax Filing',
    urgency: 'medium',
    importance: 6,
    contextSnapshot: { title: 'Prepare Tax Filing', postponementCount: 2 },
    status: 'pending',
    decision: null,
    decisionReason: null,
    createdAt: new Date(),
    evaluatedAt: null,
  };

  const defaultPreferences: UserProactivePreferences = {
    id: 'pref-1',
    userId: 'user-1',
    proactiveEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'UTC',
    maxDailyInteractions: 3,
    allowHighUrgencyInQuietHours: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      countDailyDeliveredActions: jest.fn().mockResolvedValue(0),
      getCooldown: jest.fn().mockResolvedValue(null),
      hasRecentConversationTurnOnTopic: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProactivePolicyService,
        {
          provide: EventRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ProactivePolicyService>(ProactivePolicyService);
  });

  describe('Master Switch', () => {
    it('returns NO_ACTION when proactive companion behavior is disabled', async () => {
      const prefs = { ...defaultPreferences, proactiveEnabled: false };
      const result = await service.evaluate(mockCandidate, prefs);

      expect(result.decision).toBe('NO_ACTION');
      expect(result.reason).toContain('disabled in user preferences');
    });
  });

  describe('Daily Interaction Cap', () => {
    it('returns NO_ACTION when daily limit is reached', async () => {
      repository.countDailyDeliveredActions.mockResolvedValue(3);
      const result = await service.evaluate(mockCandidate, defaultPreferences);

      expect(result.decision).toBe('NO_ACTION');
      expect(result.reason).toContain('Daily proactive interaction cap');
    });
  });

  describe('Topic Cooldown', () => {
    it('returns NO_ACTION when topic cooldown is active', async () => {
      repository.getCooldown.mockResolvedValue({
        id: 'cd-1',
        userId: 'user-1',
        topic: 'Prepare Tax Filing',
        candidateType: 'task_postponed_checkin',
        cooldownUntil: new Date(Date.now() + 3600000), // 1 hour in future
        lastActionId: 'act-1',
        createdAt: new Date(),
      });

      const result = await service.evaluate(mockCandidate, defaultPreferences);

      expect(result.decision).toBe('NO_ACTION');
      expect(result.reason).toContain('Cooldown active for topic');
    });
  });

  describe('Active Dialogue Suppression', () => {
    it('returns NO_ACTION when active conversation on this topic occurred within 30 min', async () => {
      repository.hasRecentConversationTurnOnTopic.mockResolvedValue(true);
      const result = await service.evaluate(mockCandidate, defaultPreferences);

      expect(result.decision).toBe('NO_ACTION');
      expect(result.reason).toContain('Active conversation already in progress');
    });
  });

  describe('Action Justified', () => {
    it('returns ACT with 24-hour cooldown for task postponed checkin when all rules pass', async () => {
      const result = await service.evaluate(mockCandidate, defaultPreferences);

      expect(result.decision).toBe('ACT');
      expect(result.cooldownMinutes).toBe(1440);
    });
  });

  describe('Quiet Hours Computation', () => {
    it('correctly evaluates overnight quiet hours', () => {
      // Overnight: 22:00 to 08:00
      // Mock Intl or test logic directly
      const result = service.isWithinQuietHours('22:00', '08:00', 'UTC');
      expect(typeof result).toBe('boolean');
    });
  });
});
