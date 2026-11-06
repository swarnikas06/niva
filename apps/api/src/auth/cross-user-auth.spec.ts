import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { LifeContextService } from '../life-context/life-context.service';
import { ConversationService } from '../conversation/conversation.service';
import { MemoryService } from '../memory/memory.service';

describe('Cross-User Authorization & IDOR Defense Suite', () => {
  const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  describe('Life Context IDOR Defense (Tasks, Goals, Commitments)', () => {
    let lifeContextService: LifeContextService;
    let mockRepo: any;
    let mockPublisher: any;

    beforeEach(() => {
      mockRepo = {
        findGoalById: jest.fn(),
        updateGoal: jest.fn(),
        deleteGoal: jest.fn(),
        findTaskById: jest.fn(),
        updateTask: jest.fn(),
        deleteTask: jest.fn(),
        findCommitmentById: jest.fn(),
        updateCommitment: jest.fn(),
      };
      mockPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
      lifeContextService = new LifeContextService(mockRepo, mockPublisher);
    });

    it('should prevent User B from viewing User A task (returns 404 / access denied)', async () => {
      const taskAId = 'task-a-123';
      // User A owns the task, so querying with User B returns null
      mockRepo.findTaskById.mockImplementation(async (id: string, userId: string) => {
        if (id === taskAId && userId === userA) {
          return { id: taskAId, userId: userA, title: 'Private User A Task' };
        }
        return null;
      });

      // User B attempts to access User A's task
      await expect(lifeContextService.getTaskById(taskAId, userB)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent User B from modifying User A task', async () => {
      const taskAId = 'task-a-123';
      mockRepo.findTaskById.mockImplementation(async (id: string, userId: string) => {
        if (id === taskAId && userId === userA) {
          return { id: taskAId, userId: userA, title: 'Private User A Task' };
        }
        return null;
      });

      await expect(
        lifeContextService.updateTask(taskAId, userB, { title: 'Compromised Title' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.updateTask).not.toHaveBeenCalled();
    });

    it('should prevent User B from viewing User A goal', async () => {
      const goalAId = 'goal-a-123';
      mockRepo.findGoalById.mockImplementation(async (id: string, userId: string) => {
        if (id === goalAId && userId === userA) {
          return { id: goalAId, userId: userA, title: 'Private Goal' };
        }
        return null;
      });

      await expect(lifeContextService.getGoalById(goalAId, userB)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent User B from viewing User A commitment', async () => {
      const comAId = 'com-a-123';
      mockRepo.findCommitmentById.mockImplementation(async (id: string, userId: string) => {
        if (id === comAId && userId === userA) {
          return { id: comAId, userId: userA, title: 'Private Commitment' };
        }
        return null;
      });

      await expect(lifeContextService.getCommitmentById(comAId, userB)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Conversation IDOR Defense', () => {
    let conversationService: ConversationService;
    let mockConvRepo: any;
    let mockOrchestrator: any;

    beforeEach(() => {
      mockConvRepo = {
        findConversationById: jest.fn(),
        getMessages: jest.fn(),
      };
      mockOrchestrator = {} as any;
      conversationService = new ConversationService(mockConvRepo, mockOrchestrator);
    });

    it('should prevent User B from viewing User A conversation history', async () => {
      const convAId = 'conv-a-123';
      mockConvRepo.findConversationById.mockImplementation(
        async (id: string, userId: string) => {
          if (id === convAId && userId === userA) {
            return {
              id: convAId,
              userId: userA,
              title: 'Private Chat',
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return null;
        },
      );

      await expect(
        conversationService.getConversationById(convAId, userB),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent User B from listing messages of User A conversation', async () => {
      const convAId = 'conv-a-123';
      mockConvRepo.findConversationById.mockImplementation(
        async (id: string, userId: string) => {
          if (id === convAId && userId === userA) {
            return { id: convAId, userId: userA, title: 'Private Chat', status: 'active' };
          }
          return null;
        },
      );

      await expect(
        conversationService.getMessages(convAId, userB),
      ).rejects.toThrow(NotFoundException);
      expect(mockConvRepo.getMessages).not.toHaveBeenCalled();
    });
  });

  describe('Memory IDOR Defense', () => {
    let memoryService: MemoryService;
    let mockMemoryRepo: any;
    let mockAiGateway: any;
    let mockPublisher: any;

    beforeEach(() => {
      mockMemoryRepo = {
        findMemoryById: jest.fn(),
        archiveMemory: jest.fn(),
      };
      mockAiGateway = {} as any;
      mockPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
      memoryService = new MemoryService(mockMemoryRepo, mockAiGateway, mockPublisher);
    });

    it('should prevent User B from reading User A durable memory', async () => {
      const memAId = 'mem-a-123';
      mockMemoryRepo.findMemoryById.mockImplementation(
        async (id: string, userId: string) => {
          if (id === memAId && userId === userA) {
            return { id: memAId, userId: userA, content: 'Private user fact' };
          }
          return null;
        },
      );

      await expect(memoryService.getMemoryById(memAId, userB)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent User B from forgetting / deleting User A memory', async () => {
      const memAId = 'mem-a-123';
      mockMemoryRepo.findMemoryById.mockImplementation(
        async (id: string, userId: string) => {
          if (id === memAId && userId === userA) {
            return { id: memAId, userId: userA, content: 'Private user fact' };
          }
          return null;
        },
      );

      await expect(memoryService.forgetMemory(memAId, userB)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockMemoryRepo.archiveMemory).not.toHaveBeenCalled();
    });
  });
});
