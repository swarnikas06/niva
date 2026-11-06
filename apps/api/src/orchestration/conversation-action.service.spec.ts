import { Test, TestingModule } from '@nestjs/testing';
import { ConversationActionService } from './conversation-action.service';
import { LifeContextService } from '../life-context/life-context.service';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { JobSchedulerService } from '../jobs/job-scheduler.service';
import { EventRepository } from '../events/event.repository';

describe('ConversationActionService', () => {
  let service: ConversationActionService;
  let lifeContextService: Record<string, jest.Mock>;
  let lifeContextRepository: Record<string, jest.Mock>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    lifeContextService = {
      createTask: jest.fn().mockImplementation((_uid, dto) => Promise.resolve({ id: 'task-new', ...dto })),
      updateTask: jest.fn().mockImplementation((_uid, id, dto) => Promise.resolve({ id, ...dto })),
      createCommitment: jest.fn().mockImplementation((_uid, dto) => Promise.resolve({ id: 'comm-new', ...dto })),
      updateCommitment: jest.fn().mockImplementation((_uid, id, dto) => Promise.resolve({ id, ...dto })),
    };

    lifeContextRepository = {
      findTasks: jest.fn().mockResolvedValue([]),
      findCommitments: jest.fn().mockResolvedValue([]),
      findGoalById: jest.fn().mockResolvedValue(null),
      findProjectById: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationActionService,
        { provide: LifeContextService, useValue: lifeContextService },
        { provide: LifeContextRepository, useValue: lifeContextRepository },
        {
          provide: JobSchedulerService,
          useValue: {
            cancelJobsForTarget: jest.fn().mockResolvedValue(0),
            scheduleAdvanceReminders: jest.fn().mockResolvedValue([]),
            scheduleReminder: jest.fn().mockResolvedValue({ id: 'job-1' }),
            scheduleDeadlineIntelligence: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EventRepository,
          useValue: {
            createEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<ConversationActionService>(ConversationActionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Task Completion Detection & Execution', () => {
    it('should detect task completion and mark matching active task complete', async () => {
      lifeContextRepository.findTasks.mockResolvedValue([
        { id: 'task-1', title: 'Complete Math Assignment', status: 'todo' },
        { id: 'task-2', title: 'Buy Groceries', status: 'todo' },
      ]);
      lifeContextService.updateTask.mockResolvedValue({
        id: 'task-1',
        title: 'Complete Math Assignment',
        status: 'completed',
      });

      const outcomes = await service.detectAndExecuteActions(
        mockUserId,
        'I finished the math assignment!',
      );

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.actionType).toBe('task_completed');
      expect(outcomes[0]!.status).toBe('success');
      expect(outcomes[0]!.title).toBe('Complete Math Assignment');
      expect(lifeContextService.updateTask).toHaveBeenCalledWith(
        'task-1',
        mockUserId,
        { status: 'completed' },
      );
    });

    it('should handle "mark task x as done"', async () => {
      lifeContextRepository.findTasks.mockResolvedValue([
        { id: 'task-2', title: 'Review Flashcards', status: 'todo' },
      ]);
      lifeContextService.updateTask.mockResolvedValue({
        id: 'task-2',
        title: 'Review Flashcards',
        status: 'completed',
      });

      const outcomes = await service.detectAndExecuteActions(
        mockUserId,
        'Mark task "Review Flashcards" as done',
      );

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.actionType).toBe('task_completed');
      expect(outcomes[0]!.title).toBe('Review Flashcards');
      expect(lifeContextService.updateTask).toHaveBeenCalledWith(
        'task-2',
        mockUserId,
        { status: 'completed' },
      );
    });

    it('should ignore completion if no matching active task exists', async () => {
      lifeContextRepository.findTasks.mockResolvedValue([
        { id: 'task-1', title: 'Clean desk', status: 'pending' },
      ]);

      const outcomes = await service.detectAndExecuteActions(
        mockUserId,
        'I finished quantum mechanics paper',
      );

      expect(outcomes).toHaveLength(0);
      expect(lifeContextService.updateTask).not.toHaveBeenCalled();
    });
  });

  describe('Task Creation Detection & Execution', () => {
    it('should detect task creation and create task via lifeContextService', async () => {
      lifeContextRepository.findTasks.mockResolvedValue([]);
      lifeContextService.createTask.mockResolvedValue({
        id: 'task-new',
        title: 'Prepare presentation for Friday',
        priority: 'medium',
      });

      const outcomes = await service.detectAndExecuteActions(
        mockUserId,
        'Add task: Prepare presentation for Friday',
      );

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.actionType).toBe('task_created');
      expect(outcomes[0]!.status).toBe('success');
      expect(outcomes[0]!.title).toBe('Prepare presentation for Friday');
      expect(lifeContextService.createTask).toHaveBeenCalledWith(mockUserId, {
        title: 'Prepare presentation for Friday',
        priority: 'medium',
      });
    });

    it('should not duplicate an existing active task with identical title', async () => {
      lifeContextRepository.findTasks.mockResolvedValue([
        { id: 'task-existing', title: 'Buy Groceries', status: 'todo' },
      ]);

      const outcomes = await service.detectAndExecuteActions(
        mockUserId,
        'add task buy groceries',
      );

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.actionType).toBe('task_created');
      expect(outcomes[0]!.message).toContain('already in your active tasks');
      expect(lifeContextService.createTask).not.toHaveBeenCalled();
    });
  });

  describe('Reminder Creation Detection & Execution', () => {
    it('should parse and create a reminder for tomorrow with specific time', async () => {
      lifeContextRepository.findTasks.mockResolvedValue([]);
      lifeContextService.createCommitment.mockResolvedValue({
        id: 'com-1',
        title: 'review flashcards',
        commitmentType: 'deadline',
        dueAt: new Date(),
      });

      const outcomes = await service.detectAndExecuteActions(
        mockUserId,
        'Remind me tomorrow at 7 AM to review flashcards',
      );

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.actionType).toBe('commitment_created');
      expect(outcomes[0]!.status).toBe('success');
      expect(lifeContextService.createCommitment).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          title: 'review flashcards',
          commitmentType: 'deadline',
          importance: 'standard',
        }),
      );
    });
  });
});
