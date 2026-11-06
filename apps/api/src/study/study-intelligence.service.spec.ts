import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudyIntelligenceService } from './study-intelligence.service';
import { StudyRepository } from './study.repository';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { EventPublisherService } from '../events/event-publisher.service';
import { CareerRepository } from '../career/career.repository';

describe('StudyIntelligenceService', () => {
  let service: StudyIntelligenceService;
  let mockStudyRepo: any;
  let mockLifeContextRepo: any;
  let mockEventPublisher: any;
  let mockCareerRepo: any;

  const userId = '11111111-1111-1111-1111-111111111111';
  const topicId = '22222222-2222-2222-2222-222222222222';
  const sessionId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    mockStudyRepo = {
      findTopics: jest.fn().mockResolvedValue([]),
      findTopicById: jest.fn().mockResolvedValue(null),
      findTopicsByIds: jest.fn().mockResolvedValue([]),
      createTopic: jest.fn(),
      updateTopic: jest.fn(),
      deleteTopic: jest.fn().mockResolvedValue(true),
      countTopics: jest.fn().mockResolvedValue({
        total: 2,
        inProgress: 1,
        demonstrated: 0,
        needsReview: 1,
      }),
      findSessions: jest.fn().mockResolvedValue([]),
      findSessionById: jest.fn().mockResolvedValue(null),
      findActiveSession: jest.fn().mockResolvedValue(null),
      createSession: jest.fn(),
      updateSession: jest.fn(),
      sumStudyMinutes: jest.fn().mockResolvedValue(90),
      findDifficulties: jest.fn().mockResolvedValue([]),
      findDifficultyById: jest.fn().mockResolvedValue(null),
      createDifficulty: jest.fn(),
      updateDifficulty: jest.fn(),
      countActiveDifficulties: jest.fn().mockResolvedValue(1),
    };

    mockLifeContextRepo = {
      findTasks: jest.fn().mockResolvedValue([]),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockCareerRepo = {
      findUserSkill: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyIntelligenceService,
        { provide: StudyRepository, useValue: mockStudyRepo },
        { provide: LifeContextRepository, useValue: mockLifeContextRepo },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CareerRepository, useValue: mockCareerRepo },
      ],
    }).compile();

    service = module.get<StudyIntelligenceService>(StudyIntelligenceService);
  });

  describe('createTopic & updateTopic invariants', () => {
    it('should create a study topic with initial status not_started and null demonstratedProficiency', async () => {
      mockStudyRepo.createTopic.mockResolvedValue({
        id: topicId,
        userId,
        subjectName: 'Distributed Systems',
        title: 'Raft Consensus Protocol',
        status: 'not_started',
        targetProficiency: 'advanced',
        demonstratedProficiency: null,
        learningObjectives: ['Understand leader election'],
        prerequisiteTopicIds: [],
        confidenceScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockStudyRepo.findTopicById.mockResolvedValue({
        id: topicId,
        userId,
        subjectName: 'Distributed Systems',
        title: 'Raft Consensus Protocol',
        status: 'not_started',
        targetProficiency: 'advanced',
        demonstratedProficiency: null,
        learningObjectives: ['Understand leader election'],
        prerequisiteTopicIds: [],
        confidenceScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createTopic(userId, {
        subjectName: 'Distributed Systems',
        title: 'Raft Consensus Protocol',
        targetProficiency: 'advanced',
        learningObjectives: ['Understand leader election'],
      });

      expect(result.id).toBe(topicId);
      expect(result.status).toBe('not_started');
      expect(result.demonstratedProficiency).toBeNull();
    });

    it('should reject updating to demonstrated without supporting evidence', async () => {
      mockStudyRepo.findTopicById.mockResolvedValue({
        id: topicId,
        userId,
        title: 'Raft Consensus Protocol',
        status: 'in_progress',
        prerequisiteTopicIds: [],
      });
      mockStudyRepo.findSessions.mockResolvedValue([]); // No sessions with evidence

      await expect(
        service.updateTopic(topicId, userId, {
          status: 'demonstrated',
          demonstratedProficiency: 'advanced',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject topic self-referencing in prerequisites', async () => {
      mockStudyRepo.findTopicById.mockResolvedValue({
        id: topicId,
        userId,
        title: 'Raft Consensus Protocol',
        status: 'in_progress',
        prerequisiteTopicIds: [],
      });

      await expect(
        service.updateTopic(topicId, userId, {
          prerequisiteTopicIds: [topicId],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('study session lifecycle', () => {
    it('should start a session and advance not_started topic to in_progress', async () => {
      mockStudyRepo.findActiveSession.mockResolvedValue(null);
      mockStudyRepo.findTopicById.mockResolvedValue({
        id: topicId,
        userId,
        title: 'Raft Consensus Protocol',
        subjectName: 'Distributed Systems',
        status: 'not_started',
      });
      mockStudyRepo.createSession.mockResolvedValue({
        id: sessionId,
        userId,
        topicId,
        sessionType: 'concept_study',
        status: 'in_progress',
        startedAt: new Date(),
        userNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const session = await service.startSession(userId, {
        topicId,
        sessionType: 'concept_study',
      });

      expect(session.id).toBe(sessionId);
      expect(session.status).toBe('in_progress');
      expect(mockStudyRepo.updateTopic).toHaveBeenCalledWith(topicId, userId, {
        status: 'in_progress',
      });
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should complete session, calculate duration, and auto-record difficulties', async () => {
      const startedAt = new Date(Date.now() - 35 * 60000); // 35 minutes ago
      mockStudyRepo.findSessionById.mockResolvedValue({
        id: sessionId,
        userId,
        topicId,
        topicTitle: 'Raft Consensus Protocol',
        subjectName: 'Distributed Systems',
        sessionType: 'concept_study',
        status: 'in_progress',
        startedAt,
        conceptsUnderstood: [],
        difficultiesEncountered: [],
        followUpActions: [],
        evidenceNotes: null,
      });

      mockStudyRepo.updateSession.mockResolvedValue({
        id: sessionId,
        userId,
        topicId,
        topicTitle: 'Raft Consensus Protocol',
        subjectName: 'Distributed Systems',
        sessionType: 'concept_study',
        status: 'completed',
        startedAt,
        completedAt: new Date(),
        durationMinutes: 35,
        userNotes: 'Understood leader election invariants well',
        conceptsUnderstood: ['Leader election term comparison'],
        difficultiesEncountered: ['Joint consensus membership changes'],
        followUpActions: ['Read section 6 of Raft dissertation'],
        evidenceNotes: 'Implemented election timer reset and vote request RPC handling',
        createdAt: startedAt,
        updatedAt: new Date(),
      });

      mockStudyRepo.findTopicById.mockResolvedValue({
        id: topicId,
        userId,
        status: 'in_progress',
        demonstratedProficiency: null,
      });

      const completed = await service.completeSession(sessionId, userId, {
        userNotes: 'Understood leader election invariants well',
        conceptsUnderstood: ['Leader election term comparison'],
        difficultiesEncountered: ['Joint consensus membership changes'],
        followUpActions: ['Read section 6 of Raft dissertation'],
        evidenceNotes: 'Implemented election timer reset and vote request RPC handling',
      });

      expect(completed.status).toBe('completed');
      expect(completed.durationMinutes).toBe(35);
      expect(mockStudyRepo.createDifficulty).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: 'Joint consensus membership changes',
          source: 'user_reported',
        }),
      );
    });
  });

  describe('next-step recommendations', () => {
    it('should prioritize topics with active recorded difficulties as critical', async () => {
      mockStudyRepo.findTopics.mockResolvedValue([
        {
          id: topicId,
          userId,
          title: 'Raft Consensus Protocol',
          subjectName: 'Distributed Systems',
          status: 'in_progress',
          prerequisiteTopicIds: [],
        },
      ]);
      mockStudyRepo.findDifficulties.mockResolvedValue([
        {
          id: 'diff-1',
          topicId,
          concept: 'Log compaction snapshotting',
          status: 'active',
        },
      ]);
      mockStudyRepo.findSessions.mockResolvedValue([]);
      mockLifeContextRepo.findTasks.mockResolvedValue([]);

      const recs = await service.getRecommendations(userId);

      expect(recs.length).toBe(1);
      expect(recs[0].priority).toBe('critical');
      expect(recs[0].activeDifficultiesCount).toBe(1);
      expect(recs[0].what).toContain('Targeted revision');
    });

    it('should link matching Life Context tasks without duplicate task creation', async () => {
      mockStudyRepo.findTopics.mockResolvedValue([
        {
          id: topicId,
          userId,
          title: 'Raft Consensus Protocol',
          subjectName: 'Distributed Systems',
          status: 'in_progress',
          prerequisiteTopicIds: [],
        },
      ]);
      mockStudyRepo.findDifficulties.mockResolvedValue([]);
      mockStudyRepo.findSessions.mockResolvedValue([]);
      mockLifeContextRepo.findTasks.mockResolvedValue([
        {
          id: 'task-101',
          title: 'Implement Raft protocol tests',
          description: 'Distributed Systems practice',
          status: 'todo',
          priority: 'high',
        },
      ]);

      const recs = await service.getRecommendations(userId);

      expect(recs.length).toBe(1);
      expect(recs[0].linkedLifeTasks).toBeDefined();
      expect(recs[0].linkedLifeTasks?.length).toBe(1);
      expect(recs[0].linkedLifeTasks?.[0].id).toBe('task-101');
    });
  });

  describe('assembleStudyContext', () => {
    it('should assemble structured StudyContextFrame for LLM grounding', async () => {
      mockStudyRepo.findTopics.mockResolvedValue([
        {
          id: topicId,
          title: 'Raft Consensus Protocol',
          subjectName: 'Distributed Systems',
          status: 'in_progress',
          targetProficiency: 'advanced',
          demonstratedProficiency: null,
          learningObjectives: ['Leader election'],
          prerequisiteTopicIds: [],
        },
      ]);
      mockStudyRepo.findDifficulties.mockResolvedValue([
        {
          concept: 'Pre-vote phase',
          topicTitle: 'Raft Consensus Protocol',
          source: 'user_reported',
          description: 'Confused by network partition edge case',
        },
      ]);
      mockStudyRepo.findSessions.mockResolvedValue([
        {
          topicTitle: 'Raft Consensus Protocol',
          sessionType: 'concept_study',
          status: 'completed',
          durationMinutes: 40,
          completedAt: new Date(),
          conceptsUnderstood: ['Heartbeats'],
          difficultiesEncountered: ['Pre-vote phase'],
        },
      ]);

      const frame = await service.assembleStudyContext(userId);

      expect(frame.activeFocusTopic).toBeDefined();
      expect(frame.activeFocusTopic?.title).toBe('Raft Consensus Protocol');
      expect(frame.activeDifficulties.length).toBe(1);
      expect(frame.activeDifficulties[0].concept).toBe('Pre-vote phase');
      expect(frame.recentStudySessions.length).toBe(1);
    });
  });
});
