import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationRepository } from './conversation.repository';
import { CompanionOrchestratorService } from '../orchestration/companion-orchestrator.service';

describe('ConversationService', () => {
  let service: ConversationService;
  let repository: Record<string, jest.Mock>;
  let companionOrchestrator: Record<string, jest.Mock>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';
  const mockConvId = 'aaaa-bbbb-cccc-dddd';

  const mockArchetype = {
    id: 'aria',
    name: 'Aria',
    tagline: 'Reflective, articulate, systems thinker',
    description: 'System thinker and companion',
    defaultWarmth: 80,
    defaultDirectness: 70,
  };

  beforeEach(async () => {
    repository = {
      findConversations: jest.fn(),
      findConversationById: jest.fn(),
      createConversation: jest.fn(),
      updateConversation: jest.fn(),
      deleteConversation: jest.fn(),
      findCharacterArchetype: jest.fn(),
      findMessages: jest.fn(),
      createMessage: jest.fn(),
    };

    companionOrchestrator = {
      orchestrateConversationTurn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: ConversationRepository,
          useValue: repository,
        },
        {
          provide: CompanionOrchestratorService,
          useValue: companionOrchestrator,
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
  });

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  describe('Conversations', () => {
    it('should create a conversation when character archetype exists', async () => {
      repository.findCharacterArchetype.mockResolvedValue(mockArchetype);
      repository.createConversation.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        characterId: 'aria',
        title: 'New Conversation',
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createConversation(mockUserId, {
        characterId: 'aria',
      });

      expect(result.id).toBe(mockConvId);
      expect(result.characterId).toBe('aria');
      expect(result.character?.name).toBe('Aria');
      expect(repository.findCharacterArchetype).toHaveBeenCalledWith('aria');
      expect(repository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          characterId: 'aria',
          title: 'New Conversation',
        }),
      );
    });

    it('should reject creating conversation if character archetype is not found', async () => {
      repository.findCharacterArchetype.mockResolvedValue(null);

      await expect(
        service.createConversation(mockUserId, {
          characterId: 'non-existent-character',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should list conversations belonging to the user', async () => {
      const now = new Date();
      repository.findConversations.mockResolvedValue([
        {
          id: 'conv-1',
          userId: mockUserId,
          characterId: 'aria',
          title: 'Study session',
          status: 'active',
          metadata: {},
          createdAt: now,
          updatedAt: now,
          character: { id: 'aria', name: 'Aria' },
          lastMessage: null,
        },
      ]);

      const result = await service.getConversations(mockUserId);

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.title).toBe('Study session');
      expect(repository.findConversations).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object),
      );
    });

    it('should retrieve single conversation with character details', async () => {
      const now = new Date();
      repository.findConversationById.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        characterId: 'aria',
        title: 'Deep discussion',
        status: 'active',
        metadata: {},
        createdAt: now,
        updatedAt: now,
        character: { id: 'aria', name: 'Aria' },
        lastMessage: null,
      });

      const result = await service.getConversationById(mockConvId, mockUserId);

      expect(result.id).toBe(mockConvId);
      expect(result.title).toBe('Deep discussion');
      expect(repository.findConversationById).toHaveBeenCalledWith(mockConvId, mockUserId);
    });

    it('should throw NotFoundException if conversation belongs to another user or does not exist', async () => {
      repository.findConversationById.mockResolvedValue(null);

      await expect(
        service.getConversationById(mockConvId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update conversation title and archive status', async () => {
      const now = new Date();
      repository.findConversationById.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        characterId: 'aria',
        title: 'Old Title',
        status: 'active',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });

      repository.updateConversation.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        characterId: 'aria',
        title: 'New Title',
        status: 'archived',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.updateConversation(mockConvId, mockUserId, {
        title: 'New Title',
        status: 'archived',
      });

      expect(repository.updateConversation).toHaveBeenCalledWith(
        mockConvId,
        mockUserId,
        expect.objectContaining({
          title: 'New Title',
          status: 'archived',
        }),
      );
      expect(result.id).toBe(mockConvId);
    });

    it('should throw NotFoundException on deleting foreign or non-existent conversation', async () => {
      repository.deleteConversation.mockResolvedValue(false);

      await expect(
        service.deleteConversation('foreign-conv', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete conversation when owned by the user', async () => {
      repository.deleteConversation.mockResolvedValue(true);

      await expect(
        service.deleteConversation(mockConvId, mockUserId),
      ).resolves.not.toThrow();
    });
  });

  // ==========================================
  // MESSAGES
  // ==========================================
  describe('Messages', () => {
    it('should delegate createMessage to companionOrchestrator', async () => {
      const mockResult: any = {
        userMessage: { id: 'msg-1', senderRole: 'user', content: 'Hello Aria' },
        assistantMessage: { id: 'msg-2', senderRole: 'assistant', content: 'Hello!' },
        metadata: { provider: 'mock', model: 'niva-mock-v1', latencyMs: 50 },
        decision: { decision: 'respond', mode: 'acknowledge', rationale: 'Standard dialogue' },
      };

      companionOrchestrator.orchestrateConversationTurn.mockResolvedValue(mockResult);

      const result = await service.createMessage(mockConvId, mockUserId, {
        content: 'Hello Aria',
      });

      expect(result).toBe(mockResult);
      expect(companionOrchestrator.orchestrateConversationTurn).toHaveBeenCalledWith({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'Hello Aria',
        metadata: undefined,
      });
    });

    it('should re-throw if companionOrchestrator fails', async () => {
      companionOrchestrator.orchestrateConversationTurn.mockRejectedValue(
        new Error('AI Gateway Error'),
      );

      await expect(
        service.createMessage(mockConvId, mockUserId, { content: 'Hello Aria' }),
      ).rejects.toThrow('AI Gateway Error');
    });

    it('should retrieve messages with deterministic sequence ordering and pagination', async () => {
      const now = new Date();
      repository.findConversationById.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
      });

      repository.findMessages.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: mockConvId,
          senderRole: 'user',
          content: 'First message',
          sequenceNumber: 1,
          status: 'complete',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'msg-2',
          conversationId: mockConvId,
          senderRole: 'user',
          content: 'Second message',
          sequenceNumber: 2,
          status: 'complete',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.getMessages(mockConvId, mockUserId, {
        limit: 10,
        cursor: 0,
        direction: 'forward',
      });

      expect(result.items.length).toBe(2);
      expect(result.items[0]?.sequenceNumber).toBe(1);
      expect(result.items[1]?.sequenceNumber).toBe(2);
      expect(result.nextCursor).toBe(2);
      expect(result.prevCursor).toBe(1);
      expect(repository.findMessages).toHaveBeenCalledWith(mockConvId, {
        limit: 10,
        cursor: 0,
        direction: 'forward',
      });
    });

    it('should throw NotFoundException when getting messages for a foreign conversation', async () => {
      repository.findConversationById.mockResolvedValue(null);

      await expect(
        service.getMessages('foreign-conv', mockUserId),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findMessages).not.toHaveBeenCalled();
    });
  });
});
