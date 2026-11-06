import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LifeContextService } from './life-context.service';
import { LifeContextRepository } from './life-context.repository';
import { EventPublisherService } from '../events/event-publisher.service';
import { JobSchedulerService } from '../jobs/job-scheduler.service';

describe('LifeContextService', () => {
  let service: LifeContextService;
  let repository: Record<string, jest.Mock>;
  let eventPublisher: Record<string, jest.Mock>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    eventPublisher = {
      publish: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
    };

    repository = {
      // Goals
      findGoals: jest.fn(),
      findGoalById: jest.fn(),
      createGoal: jest.fn(),
      updateGoal: jest.fn(),
      deleteGoal: jest.fn(),
      // Projects
      findProjects: jest.fn(),
      findProjectById: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      // Tasks
      findTasks: jest.fn(),
      findTaskById: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      // Commitments
      findCommitments: jest.fn(),
      findCommitmentById: jest.fn(),
      createCommitment: jest.fn(),
      updateCommitment: jest.fn(),
      deleteCommitment: jest.fn(),
      // Ideas
      findIdeas: jest.fn(),
      findIdeaById: jest.fn(),
      createIdea: jest.fn(),
      updateIdea: jest.fn(),
      deleteIdea: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LifeContextService,
        {
          provide: LifeContextRepository,
          useValue: repository,
        },
        {
          provide: EventPublisherService,
          useValue: eventPublisher,
        },
        {
          provide: JobSchedulerService,
          useValue: {
            cancelJobsForTarget: jest.fn().mockResolvedValue(0),
            scheduleAdvanceReminders: jest.fn().mockResolvedValue([]),
            scheduleDeadlineIntelligence: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<LifeContextService>(LifeContextService);
  });

  // ==========================================
  // GOALS
  // ==========================================
  describe('Goals', () => {
    it('should create a goal successfully', async () => {
      const mockGoal = {
        id: 'goal-1',
        userId: mockUserId,
        title: 'Master System Design',
        description: 'Read designing data intensive apps',
        category: 'technical',
        targetDate: '2026-12-31',
        status: 'active',
        priority: 'high',
        progressPercentage: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.createGoal.mockResolvedValue(mockGoal);

      const result = await service.createGoal(mockUserId, {
        title: 'Master System Design',
        description: 'Read designing data intensive apps',
        category: 'technical',
        targetDate: '2026-12-31',
        priority: 'high',
        progressPercentage: 20,
      });

      expect(result.id).toBe('goal-1');
      expect(result.title).toBe('Master System Design');
      expect(result.progressPercentage).toBe(20);
      expect(repository.createGoal).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent or foreign goal', async () => {
      repository.findGoalById.mockResolvedValue(null);

      await expect(
        service.updateGoal('goal-999', mockUserId, { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete a goal when owned by user', async () => {
      repository.deleteGoal.mockResolvedValue(true);
      await expect(service.deleteGoal('goal-1', mockUserId)).resolves.not.toThrow();
    });

    it('should throw NotFoundException on deleting foreign goal', async () => {
      repository.deleteGoal.mockResolvedValue(false);
      await expect(service.deleteGoal('goal-foreign', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================
  // PROJECTS & RELATIONSHIPS
  // ==========================================
  describe('Projects', () => {
    it('should create a project linked to a valid goal owned by the user', async () => {
      const mockGoal = { id: 'goal-1', userId: mockUserId };
      repository.findGoalById.mockResolvedValue(mockGoal);

      const mockProject = {
        id: 'proj-1',
        userId: mockUserId,
        goalId: 'goal-1',
        title: 'Distributed Cache in Go',
        description: 'Raft consensus and cache eviction',
        status: 'in_progress',
        color: '#10b981',
        startDate: null,
        targetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.createProject.mockResolvedValue(mockProject);

      const result = await service.createProject(mockUserId, {
        goalId: 'goal-1',
        title: 'Distributed Cache in Go',
      });

      expect(result.id).toBe('proj-1');
      expect(result.goalId).toBe('goal-1');
      expect(repository.findGoalById).toHaveBeenCalledWith('goal-1', mockUserId);
    });

    it('should reject creating a project linked to a foreign user goal', async () => {
      // Goal does not belong to mockUserId
      repository.findGoalById.mockResolvedValue(null);

      await expect(
        service.createProject(mockUserId, {
          goalId: 'foreign-goal-id',
          title: 'Unauthorized Project',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // TASKS & COMPLETION LOGIC
  // ==========================================
  describe('Tasks', () => {
    it('should populate completedAt when task status transitions to completed', async () => {
      const existingTask = {
        id: 'task-1',
        userId: mockUserId,
        title: 'Implement LRU eviction',
        status: 'todo',
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findTaskById.mockResolvedValue(existingTask);

      const updatedTask = {
        ...existingTask,
        status: 'completed',
        completedAt: new Date(),
      };
      repository.updateTask.mockResolvedValue(updatedTask);

      const result = await service.updateTask('task-1', mockUserId, {
        status: 'completed',
      });

      expect(result.status).toBe('completed');
      expect(result.completedAt).not.toBeNull();
      // Ensure repository was called with completedAt date
      expect(repository.updateTask).toHaveBeenCalledWith(
        'task-1',
        mockUserId,
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should clear completedAt when task is reopened from completed to in_progress', async () => {
      const completedTask = {
        id: 'task-1',
        userId: mockUserId,
        title: 'Implement LRU eviction',
        status: 'completed',
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findTaskById.mockResolvedValue(completedTask);

      const reopenedTask = {
        ...completedTask,
        status: 'in_progress',
        completedAt: null,
      };
      repository.updateTask.mockResolvedValue(reopenedTask);

      const result = await service.updateTask('task-1', mockUserId, {
        status: 'in_progress',
      });

      expect(result.status).toBe('in_progress');
      expect(result.completedAt).toBeNull();
      expect(repository.updateTask).toHaveBeenCalledWith(
        'task-1',
        mockUserId,
        expect.objectContaining({
          status: 'in_progress',
          completedAt: null,
        }),
      );
    });

    it('should reject creating a task linked to a foreign project', async () => {
      repository.findProjectById.mockResolvedValue(null);

      await expect(
        service.createTask(mockUserId, {
          projectId: 'foreign-project-id',
          title: 'Unauthorized Task',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // COMMITMENTS
  // ==========================================
  describe('Commitments', () => {
    it('should create commitment with valid timestamp and relations', async () => {
      const mockCommitment = {
        id: 'comm-1',
        userId: mockUserId,
        title: 'Mock Interview with Senior SRE',
        description: 'System design focus',
        commitmentType: 'interview',
        dueAt: new Date('2026-10-10T10:00:00Z'),
        status: 'upcoming',
        importance: 'critical',
        relatedGoalId: null,
        relatedProjectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.createCommitment.mockResolvedValue(mockCommitment);

      const result = await service.createCommitment(mockUserId, {
        title: 'Mock Interview with Senior SRE',
        commitmentType: 'interview',
        dueAt: '2026-10-10T10:00:00Z',
        importance: 'critical',
      });

      expect(result.id).toBe('comm-1');
      expect(result.commitmentType).toBe('interview');
      expect(result.importance).toBe('critical');
    });

    it('should reject commitment referencing another user goal', async () => {
      repository.findGoalById.mockResolvedValue(null);

      await expect(
        service.createCommitment(mockUserId, {
          title: 'Interview',
          commitmentType: 'interview',
          dueAt: '2026-10-10T10:00:00Z',
          relatedGoalId: 'foreign-goal',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // IDEAS & PROMOTE WORKFLOW
  // ==========================================
  describe('Ideas', () => {
    it('should create an idea with tags', async () => {
      const mockIdea = {
        id: 'idea-1',
        userId: mockUserId,
        title: 'Vector Search Benchmarking in Rust',
        content: 'Compare HNSW with IVF-PQ performance on large embeddings',
        tags: ['rust', 'search', 'vector'],
        status: 'raw',
        promotedToProjectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.createIdea.mockResolvedValue(mockIdea);

      const result = await service.createIdea(mockUserId, {
        title: 'Vector Search Benchmarking in Rust',
        content: 'Compare HNSW with IVF-PQ performance on large embeddings',
        tags: ['rust', 'search', 'vector'],
      });

      expect(result.id).toBe('idea-1');
      expect(result.tags).toEqual(['rust', 'search', 'vector']);
      expect(result.status).toBe('raw');
    });

    it('should promote an idea to project atomically', async () => {
      const mockIdea = {
        id: 'idea-1',
        userId: mockUserId,
        title: 'Vector Search Benchmarking in Rust',
        content: 'Compare HNSW with IVF-PQ performance',
        tags: ['rust'],
        status: 'raw',
        promotedToProjectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findIdeaById.mockResolvedValue(mockIdea);

      const mockNewProject = {
        id: 'proj-new-1',
        userId: mockUserId,
        title: 'Vector Search Benchmarking in Rust',
        description: 'Compare HNSW with IVF-PQ performance',
        status: 'planning',
        color: null,
        goalId: null,
        startDate: null,
        targetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.createProject.mockResolvedValue(mockNewProject);

      const mockUpdatedIdea = {
        ...mockIdea,
        status: 'promoted',
        promotedToProjectId: 'proj-new-1',
      };
      repository.updateIdea.mockResolvedValue(mockUpdatedIdea);

      const result = await service.promoteIdeaToProject('idea-1', mockUserId, {});

      expect(result.project.id).toBe('proj-new-1');
      expect(result.idea.status).toBe('promoted');
      expect(result.idea.promotedToProjectId).toBe('proj-new-1');
      expect(repository.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          title: 'Vector Search Benchmarking in Rust',
          status: 'planning',
        }),
      );
    });

    it('should reject promoting an already promoted idea', async () => {
      const alreadyPromotedIdea = {
        id: 'idea-promoted',
        userId: mockUserId,
        title: 'Already promoted',
        content: 'content',
        status: 'promoted',
        promotedToProjectId: 'existing-proj',
      };
      repository.findIdeaById.mockResolvedValue(alreadyPromotedIdea);

      await expect(
        service.promoteIdeaToProject('idea-promoted', mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // OVERVIEW AGGREGATION
  // ==========================================
  describe('Overview', () => {
    it('should aggregate life overview with correct counts and 7-day window', async () => {
      const dateNow = new Date();
      repository.findGoals.mockResolvedValue([
        {
          id: 'g-1',
          userId: mockUserId,
          title: 'G1',
          category: 'career',
          status: 'active',
          priority: 'high',
          progressPercentage: 50,
          createdAt: dateNow,
          updatedAt: dateNow,
        },
      ]);
      repository.findProjects.mockResolvedValue([
        {
          id: 'p-1',
          userId: mockUserId,
          title: 'P1',
          status: 'in_progress',
          createdAt: dateNow,
          updatedAt: dateNow,
        },
      ]);
      repository.findTasks.mockResolvedValue([
        {
          id: 't-1',
          userId: mockUserId,
          title: 'T1',
          status: 'todo',
          priority: 'urgent',
          orderIndex: 0,
          createdAt: dateNow,
          updatedAt: dateNow,
        },
      ]);
      repository.findCommitments.mockResolvedValue([
        {
          id: 'c-1',
          userId: mockUserId,
          title: 'C1',
          commitmentType: 'exam',
          dueAt: new Date(dateNow.getTime() + 2 * 24 * 3600 * 1000),
          status: 'upcoming',
          importance: 'high',
          createdAt: dateNow,
          updatedAt: dateNow,
        },
      ]);
      repository.findIdeas.mockResolvedValue([
        {
          id: 'i-1',
          userId: mockUserId,
          title: 'I1',
          content: 'C1',
          tags: [],
          status: 'raw',
          createdAt: dateNow,
          updatedAt: dateNow,
        },
      ]);

      const overview = await service.getOverview(mockUserId);

      expect(overview.summary.activeGoalsCount).toBe(1);
      expect(overview.summary.activeProjectsCount).toBe(1);
      expect(overview.summary.pendingTasksCount).toBe(1);
      expect(overview.summary.urgentTasksCount).toBe(1);
      expect(overview.summary.imminentCommitmentsCount).toBe(1);
      expect(overview.activeGoals.length).toBe(1);
      expect(overview.imminentCommitments.length).toBe(1);
      expect(repository.findCommitments).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          status: 'upcoming',
          from: expect.any(Date),
          to: expect.any(Date),
        }),
      );
    });
  });
});
