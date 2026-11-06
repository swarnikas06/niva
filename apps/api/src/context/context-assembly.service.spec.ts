import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContextAssemblyService } from './context-assembly.service';
import { CompanionStateService } from './companion-state.service';
import { ContextSnapshotRepository } from './context-snapshot.repository';
import { MemoryRetrievalService } from '../memory/memory-retrieval.service';
import { DRIZZLE_DB } from '../database/database.service';

describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;
  let snapshotRepo: jest.Mocked<ContextSnapshotRepository>;
  let mockDb: any;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockConvId = '22222222-2222-2222-2222-222222222222';

  const mockCompanionState = {
    id: 'state-1',
    userId: mockUserId,
    characterId: 'niva_anchor',
    presenceStatus: 'active' as const,
    interactionMode: 'chat' as const,
    activeFocusGoalId: null,
    activeFocusProjectId: null,
    continuityStreakDays: 3,
    totalInteractions: 12,
    lastInteractionAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeFocusGoal: {
      id: 'goal-1',
      title: 'Master Rust Systems Programming',
      progressPercentage: 45,
      status: 'active',
    },
    activeFocusProject: null,
  };

  const createQueryMock = (data: any) => {
    const qb: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(data),
      then: (resolve: any) => Promise.resolve(data).then(resolve),
    };
    return qb;
  };

  beforeEach(async () => {
    const mockStateService = {
      getCompanionState: jest.fn().mockResolvedValue(mockCompanionState),
    };

    const mockSnapshot = {
      saveSnapshot: jest.fn().mockResolvedValue({ id: 'snapshot-uuid-99' }),
      listRecentSnapshots: jest.fn(),
      getSnapshotById: jest.fn(),
    };

    mockDb = {
      select: jest.fn().mockImplementation(() => createQueryMock([])),
    };

    const mockMemoryRetrievalService = {
      retrieveRelevantMemories: jest.fn().mockResolvedValue({
        memories: [],
        totalRetrieved: 0,
        tokenCountEstimated: 0,
        queryLatencyMs: 5,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextAssemblyService,
        { provide: CompanionStateService, useValue: mockStateService },
        { provide: ContextSnapshotRepository, useValue: mockSnapshot },
        { provide: MemoryRetrievalService, useValue: mockMemoryRetrievalService },
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ContextAssemblyService>(ContextAssemblyService);
    snapshotRepo = module.get(ContextSnapshotRepository);
  });

  describe('assembleContext', () => {
    it('throws NotFoundException if user does not exist', async () => {
      mockDb.select.mockReturnValueOnce(createQueryMock([])); // user not found

      await expect(
        service.assembleContext(mockUserId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if conversation does not belong to user', async () => {
      mockDb.select
        .mockReturnValueOnce(createQueryMock([{ id: mockUserId, name: 'Alice' }])) // 1. user
        .mockReturnValueOnce(createQueryMock([{ selectedArchetypeId: 'niva_anchor' }])) // 2. personalization
        .mockReturnValueOnce(createQueryMock([{ id: 'niva_anchor', name: 'The Balanced Anchor' }])) // 3. archetype
        .mockReturnValueOnce(createQueryMock([])) // 4. goals
        .mockReturnValueOnce(createQueryMock([])) // 5. projects
        .mockReturnValueOnce(createQueryMock([])) // 6. tasks
        .mockReturnValueOnce(createQueryMock([])) // 7. commitments
        .mockReturnValueOnce(createQueryMock([])) // 8. ideas
        .mockReturnValueOnce(createQueryMock([{ count: 0 }])) // 9. goal count
        .mockReturnValueOnce(createQueryMock([{ count: 0 }])) // 10. project count
        .mockReturnValueOnce(createQueryMock([{ count: 0 }])) // 11. task count
        .mockReturnValueOnce(createQueryMock([{ count: 0 }])) // 12. comm count
        .mockReturnValueOnce(createQueryMock([{ count: 0 }])) // 13. idea count
        .mockReturnValueOnce(createQueryMock([])); // 14. conversation lookup fails

      await expect(
        service.assembleContext(mockUserId, { conversationId: mockConvId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('assembles a full deterministic context frame successfully', async () => {
      mockDb.select
        .mockReturnValueOnce(createQueryMock([{ id: mockUserId, name: 'Alice Developer' }])) // 1. user
        .mockReturnValueOnce(createQueryMock([
          {
            selectedArchetypeId: 'niva_anchor',
            preferredName: 'Alice',
            occupationRole: 'Backend Engineer',
            primaryFocus: 'technical_placement',
            warmth: 80,
            directness: 70,
            humor: 50,
            challengeLevel: 65,
            proactivity: 'medium',
            responseLength: 'concise',
          },
        ])) // 2. personalization
        .mockReturnValueOnce(createQueryMock([
          {
            id: 'niva_anchor',
            name: 'The Balanced Anchor',
            tagline: 'Grounded clarity',
            description: 'A thoughtful companion',
            defaultWarmth: 80,
            defaultDirectness: 70,
            defaultHumor: 50,
            defaultChallengeLevel: 60,
            defaultProactivity: 'medium',
            defaultResponseLength: 'concise',
          },
        ])) // 3. archetype
        .mockReturnValueOnce(createQueryMock([
          {
            id: 'g-1',
            title: 'Master Distributed Consensus',
            category: 'technical',
            priority: 'high',
            progressPercentage: 30,
            targetDate: '2026-12-31',
          },
        ])) // 4. goals
        .mockReturnValueOnce(createQueryMock([
          {
            id: 'p-1',
            title: 'Raft in Go',
            goalId: 'g-1',
            status: 'in_progress',
            color: '#3b82f6',
            targetDate: '2026-11-15',
          },
        ])) // 5. projects
        .mockReturnValueOnce(createQueryMock([])) // 5b. completed projects
        .mockReturnValueOnce(createQueryMock([
          {
            id: 't-1',
            title: 'Implement log replication',
            projectId: 'p-1',
            priority: 'urgent',
            status: 'in_progress',
            dueDate: new Date(Date.now() + 86400000),
          },
        ])) // 6. tasks
        .mockReturnValueOnce(createQueryMock([])) // 6b. completed tasks
        .mockReturnValueOnce(createQueryMock([
          {
            id: 'c-1',
            title: 'Mock Distributed Systems Interview',
            commitmentType: 'interview',
            importance: 'high',
            dueAt: new Date(Date.now() + 48 * 3600 * 1000),
          },
        ])) // 7. commitments
        .mockReturnValueOnce(createQueryMock([])) // 7b. fulfilled commitments
        .mockReturnValueOnce(createQueryMock([
          {
            id: 'i-1',
            title: 'Build a CRDT visualizer',
            tags: ['crdt', 'distributed'],
            status: 'captured',
          },
        ])) // 8. ideas
        .mockReturnValueOnce(createQueryMock([{ count: 1 }])) // 9. goal count
        .mockReturnValueOnce(createQueryMock([{ count: 1 }])) // 10. project count
        .mockReturnValueOnce(createQueryMock([{ count: 1 }])) // 11. task count
        .mockReturnValueOnce(createQueryMock([{ count: 1 }])) // 12. comm count
        .mockReturnValueOnce(createQueryMock([{ count: 1 }])) // 13. idea count
        .mockReturnValueOnce(createQueryMock([{ id: mockConvId, title: 'Systems Research', status: 'active' }])) // 14. conversation
        .mockReturnValueOnce(createQueryMock([
          {
            sequenceNumber: 1,
            senderRole: 'user',
            content: 'Hello Anchor!',
            createdAt: new Date(),
          },
          {
            sequenceNumber: 2,
            senderRole: 'assistant',
            content: 'Welcome back Alice. Ready to work on Raft?',
            createdAt: new Date(),
          },
        ])); // 15. messages

      const frame = await service.assembleContext(mockUserId, {
        maxTokens: 4000,
        persistSnapshot: true,
      });

      expect(frame).toBeDefined();
      expect(frame.identity.displayName).toBe('Alice Developer');
      expect(frame.identity.preferredName).toBe('Alice');
      expect(frame.companion.name).toBe('The Balanced Anchor');
      expect(frame.companion.activeFocusGoalTitle).toBe('Master Rust Systems Programming');
      expect(frame.lifeGroundTruth.activeGoals).toHaveLength(1);
      expect(frame.lifeGroundTruth.activeProjects).toHaveLength(1);
      expect(frame.lifeGroundTruth.relevantTasks).toHaveLength(1);
      expect(frame.lifeGroundTruth.upcomingCommitments).toHaveLength(1);
      expect(frame.dialogueContext.messages).toHaveLength(2);
      expect(frame.tokenBudget.totalEstimatedTokens).toBeGreaterThan(0);
      expect(frame.tokenBudget.estimationMethod).toBe('deterministic_heuristic_4chars_per_token');
      expect(frame.snapshotId).toBe('snapshot-uuid-99');
      expect(snapshotRepo.saveSnapshot).toHaveBeenCalled();
    });
  });
});
