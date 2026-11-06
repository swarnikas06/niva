import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReflectionEngineService } from './reflection-engine.service';
import { ReflectionRepository } from './reflection.repository';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { StudyRepository } from '../study/study.repository';
import { CareerRepository } from '../career/career.repository';
import { EventPublisherService } from '../events/event-publisher.service';

describe('ReflectionEngineService', () => {
  let service: ReflectionEngineService;
  let mockReflectionRepo: any;
  let mockLifeContextRepo: any;
  let mockStudyRepo: any;
  let mockCareerRepo: any;
  let mockEventPublisher: any;

  const userId = '11111111-1111-1111-1111-111111111111';
  const obsId = '22222222-2222-2222-2222-222222222222';

  const sampleObs = {
    id: obsId,
    userId,
    category: 'learning_development',
    title: 'Consistent Study Momentum',
    fact: 'Completed 3 study sessions in Distributed Systems.',
    interpretation: 'Solid retention of consensus algorithms.',
    supportingEvidence: [],
    timeWindowStart: new Date('2026-10-01T00:00:00Z'),
    timeWindowEnd: new Date('2026-10-08T00:00:00Z'),
    windowDays: 7,
    confidence: 0.88,
    confidenceType: 'inferred_pattern',
    status: 'active',
    userCorrectionNotes: null,
    confirmedAt: null,
    correctedAt: null,
    dismissedAt: null,
    surfacedCount: 1,
    lastSurfacedAt: new Date(),
    createdAt: new Date('2026-10-08T12:00:00Z'),
    updatedAt: new Date('2026-10-08T12:00:00Z'),
  };

  beforeEach(async () => {
    mockReflectionRepo = {
      findObservations: jest.fn().mockResolvedValue([sampleObs]),
      findObservationById: jest.fn().mockImplementation(async (uid, id) => {
        if (id === obsId && uid === userId) return { ...sampleObs };
        return null;
      }),
      createObservation: jest.fn().mockImplementation(async (data) => ({
        ...data,
        id: obsId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      updateObservation: jest.fn().mockImplementation(async (uid, id, updates) => ({
        ...sampleObs,
        ...updates,
      })),
      findActiveAndConfirmedObservations: jest.fn().mockResolvedValue([sampleObs]),
      findRecentCorrections: jest.fn().mockResolvedValue([]),
      countObservationsByStatus: jest.fn().mockResolvedValue({
        total: 1,
        active: 1,
        confirmed: 0,
        corrected: 0,
        dismissed: 0,
      }),
      touchObservationsSurfaced: jest.fn().mockResolvedValue(undefined),
      createSnapshot: jest.fn().mockResolvedValue({ id: 'snap-1' }),
      getLatestSnapshot: jest.fn().mockResolvedValue(null),
    };

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    mockLifeContextRepo = {
      findTasks: jest.fn().mockResolvedValue([
        {
          id: 'task-1',
          title: 'Implement Raft heartbeat',
          status: 'completed',
          updatedAt: twoDaysAgo,
        },
      ]),
      findCommitments: jest.fn().mockResolvedValue([
        {
          id: 'comm-1',
          title: 'Study 1 hour daily',
          status: 'fulfilled',
          dueAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
        },
      ]),
    };

    mockStudyRepo = {
      findSessions: jest.fn().mockResolvedValue([
        {
          id: 'sess-1',
          topicTitle: 'Raft Log Replication',
          subjectName: 'Distributed Systems',
          durationMinutes: 45,
          status: 'completed',
          startedAt: threeDaysAgo,
          completedAt: twoDaysAgo,
        },
      ]),
      findDifficulties: jest.fn().mockResolvedValue([
        {
          id: 'diff-1',
          topicTitle: 'Leader Election',
          subjectName: 'Distributed Systems',
          difficultyText: 'Split vote edge case handling',
          status: 'active',
          createdAt: threeDaysAgo,
        },
      ]),
    };

    mockCareerRepo = {
      listEvaluationSessions: jest.fn().mockResolvedValue([]),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReflectionEngineService,
        { provide: ReflectionRepository, useValue: mockReflectionRepo },
        { provide: LifeContextRepository, useValue: mockLifeContextRepo },
        { provide: StudyRepository, useValue: mockStudyRepo },
        { provide: CareerRepository, useValue: mockCareerRepo },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<ReflectionEngineService>(ReflectionEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should aggregate counts, progress, and unresolved threads', async () => {
      const overview = await service.getOverview(userId, 14);

      expect(overview.windowDays).toBe(14);
      expect(overview.totalObservations).toBe(1);
      expect(overview.activeObservationsCount).toBe(1);
      expect(overview.recentProgress.length).toBeGreaterThan(0);
      expect(overview.unresolvedThreads.length).toBeGreaterThan(0);
      expect(overview.topObservations.length).toBe(1);
      expect(overview.topObservations[0].title).toBe('Consistent Study Momentum');
    });
  });

  describe('confirmObservation', () => {
    it('should transition observation to confirmed and emit domain event', async () => {
      const result = await service.confirmObservation(userId, obsId);

      expect(result.status).toBe('confirmed');
      expect(mockReflectionRepo.updateObservation).toHaveBeenCalledWith(
        userId,
        obsId,
        expect.objectContaining({ status: 'confirmed' }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LongitudinalObservationConfirmed',
          aggregateType: 'longitudinal_observation',
          aggregateId: obsId,
        }),
      );
    });

    it('should throw NotFoundException if observation does not exist', async () => {
      await expect(
        service.confirmObservation(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('correctObservation', () => {
    it('should update userCorrectionNotes, mark corrected, and emit event', async () => {
      const notes = 'Actually, I paused distributed systems to focus on SQL.';
      const result = await service.correctObservation(userId, obsId, {
        correctionNotes: notes,
      });

      expect(result.status).toBe('corrected');
      expect(mockReflectionRepo.updateObservation).toHaveBeenCalledWith(
        userId,
        obsId,
        expect.objectContaining({
          status: 'corrected',
          userCorrectionNotes: notes,
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LongitudinalObservationCorrected',
          aggregateId: obsId,
          payload: expect.objectContaining({ correctionNotes: notes }),
        }),
      );
    });

    it('should reject empty correction notes', async () => {
      await expect(
        service.correctObservation(userId, obsId, { correctionNotes: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('dismissObservation', () => {
    it('should mark observation dismissed and emit event', async () => {
      const result = await service.dismissObservation(userId, obsId);

      expect(result.status).toBe('dismissed');
      expect(mockReflectionRepo.updateObservation).toHaveBeenCalledWith(
        userId,
        obsId,
        expect.objectContaining({ status: 'dismissed' }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LongitudinalObservationDismissed',
          aggregateId: obsId,
        }),
      );
    });
  });

  describe('getAssembledLongitudinalContext', () => {
    it('should assemble confirmed insights, active observations, and adviceToAvoid', async () => {
      mockReflectionRepo.findActiveAndConfirmedObservations.mockResolvedValue([
        { ...sampleObs, status: 'confirmed' },
        {
          ...sampleObs,
          id: 'obs-active',
          title: 'Active Observation',
          status: 'active',
        },
      ]);
      mockReflectionRepo.findRecentCorrections.mockResolvedValue([
        {
          ...sampleObs,
          id: 'obs-corr',
          title: 'Incorrect Assumption',
          status: 'corrected',
          userCorrectionNotes: 'Do not recommend morning study routines.',
        },
      ]);

      const context = await service.getAssembledLongitudinalContext(userId);

      expect(context.confirmedInsights.length).toBe(1);
      expect(context.activeObservations.length).toBe(1);
      expect(context.activeObservations[0].fact).toBe(sampleObs.fact);
      expect(context.activeObservations[0].interpretation).toBe(sampleObs.interpretation);
      expect(context.recentUserCorrections.length).toBe(1);
      expect(context.adviceToAvoid.length).toBe(1);
      expect(context.adviceToAvoid[0]).toContain('Do not recommend morning study routines.');
      expect(mockReflectionRepo.touchObservationsSurfaced).toHaveBeenCalled();
    });
  });
});
