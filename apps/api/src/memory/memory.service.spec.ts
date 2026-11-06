import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  BadGatewayException,
} from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { EventPublisherService } from '../events/event-publisher.service';

describe('Phase 3B: MemoryService', () => {
  let service: MemoryService;
  let repository: Record<string, jest.Mock>;
  let aiGatewayService: Record<string, jest.Mock>;
  let eventPublisher: Record<string, jest.Mock>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';
  const mockConversationId = '33333333-3333-3333-3333-333333333333';
  const mockMessageId = '44444444-4444-4444-4444-444444444444';
  const mockJobId = '55555555-5555-5555-5555-555555555555';
  const mockMemoryId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    eventPublisher = {
      publish: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
    };

    repository = {
      createJob: jest.fn(),
      findJobById: jest.fn(),
      findJobsByUser: jest.fn(),
      claimJob: jest.fn(),
      updateJob: jest.fn(),
      createCandidates: jest.fn(),
      findCandidatesByUser: jest.fn(),
      findMemoryById: jest.fn(),
      upsertMemoryEmbedding: jest.fn(),
      findEmbeddingByMemoryId: jest.fn(),
      findConversationById: jest.fn(),
      findRecentConversationMessages: jest.fn(),
      findUserCharacterPersona: jest.fn(),
    };

    aiGatewayService = {
      extractMemoryCandidates: jest.fn(),
      generateEmbedding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: MemoryRepository,
          useValue: repository,
        },
        {
          provide: AiGatewayService,
          useValue: aiGatewayService,
        },
        {
          provide: EventPublisherService,
          useValue: eventPublisher,
        },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
  });

  // ============================================================================
  // JOB CREATION & OWNERSHIP
  // ============================================================================
  describe('createExtractionJob', () => {
    it('should create an extraction job when conversation is owned by user', async () => {
      repository.findConversationById.mockResolvedValue({
        id: mockConversationId,
        userId: mockUserId,
        characterId: 'niva_anchor',
      });

      const now = new Date();
      repository.createJob.mockResolvedValue({
        id: mockJobId,
        userId: mockUserId,
        conversationId: mockConversationId,
        messageId: mockMessageId,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        turnContext: { message: 'hello' },
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      const result = await service.createExtractionJob(mockUserId, {
        conversationId: mockConversationId,
        messageId: mockMessageId,
        turnContext: { message: 'hello' },
      });

      expect(result.id).toBe(mockJobId);
      expect(result.status).toBe('pending');
      expect(result.retryCount).toBe(0);
      expect(repository.findConversationById).toHaveBeenCalledWith(mockConversationId, mockUserId);
      expect(repository.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          conversationId: mockConversationId,
          status: 'pending',
        }),
      );
    });

    it('should throw NotFoundException if conversation is not found or owned by another user', async () => {
      repository.findConversationById.mockResolvedValue(null);

      await expect(
        service.createExtractionJob(otherUserId, {
          conversationId: mockConversationId,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================================
  // JOB PROCESSING LIFECYCLE & ATOMIC CLAIM
  // ============================================================================
  describe('processExtractionJob', () => {
    const mockPendingJob = {
      id: mockJobId,
      userId: mockUserId,
      conversationId: mockConversationId,
      messageId: mockMessageId,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      turnContext: { userMessage: 'I prefer Python for backend development.' },
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };

    it('should successfully claim and process job, persisting candidates with status=pending', async () => {
      repository.findJobById.mockResolvedValue(mockPendingJob);
      repository.claimJob.mockResolvedValue({ ...mockPendingJob, status: 'processing' });
      repository.findRecentConversationMessages.mockResolvedValue([
        {
          id: mockMessageId,
          conversationId: mockConversationId,
          senderRole: 'user',
          content: 'I prefer Python for backend development.',
          sequenceNumber: 1,
          createdAt: new Date(),
        },
      ]);
      repository.findUserCharacterPersona.mockResolvedValue({
        name: 'The Balanced Anchor',
        archetypeId: 'niva_anchor',
      });

      aiGatewayService.extractMemoryCandidates.mockResolvedValue({
        candidates: [
          {
            category: 'user_preference',
            content: 'User prefers Python for backend development.',
            confidence: 0.95,
            confidenceType: 'explicit',
            importance: 7,
            rationale: 'Direct statement of language preference.',
          },
        ],
        provider: 'mock',
        model: 'niva-mock-companion-v1',
        latencyMs: 25.0,
        requestId: `job-${mockJobId}`,
        extractedCount: 1,
      });

      const now = new Date();
      repository.createCandidates.mockResolvedValue([
        {
          id: 'cand-1',
          userId: mockUserId,
          jobId: mockJobId,
          sourceConversationId: mockConversationId,
          sourceMessageId: mockMessageId,
          category: 'user_preference',
          content: 'User prefers Python for backend development.',
          confidence: '0.95',
          confidenceType: 'explicit',
          status: 'pending', // INVARIANT: newly extracted candidates default to pending!
          importance: 7,
          rationale: 'Direct statement of language preference.',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
      ]);

      repository.updateJob.mockResolvedValue({
        ...mockPendingJob,
        status: 'completed',
        completedAt: now,
      });

      const result = await service.processExtractionJob(mockJobId, mockUserId);

      expect(result.job.status).toBe('completed');
      expect(result.extractedCount).toBe(1);
      expect(result.candidatesCreated[0].status).toBe('pending');
      expect(result.candidatesCreated[0].category).toBe('user_preference');
      expect(repository.claimJob).toHaveBeenCalledWith(mockJobId, mockUserId);
      expect(repository.createCandidates).toHaveBeenCalledWith([
        expect.objectContaining({
          status: 'pending',
          userId: mockUserId,
          jobId: mockJobId,
          sourceConversationId: mockConversationId,
          confidenceType: 'explicit',
        }),
      ]);
    });

    it('should be idempotent if job is already completed', async () => {
      repository.findJobById.mockResolvedValue({
        ...mockPendingJob,
        status: 'completed',
        completedAt: new Date(),
      });
      repository.findCandidatesByUser.mockResolvedValue([
        {
          id: 'cand-1',
          userId: mockUserId,
          jobId: mockJobId,
          sourceConversationId: mockConversationId,
          sourceMessageId: mockMessageId,
          category: 'user_preference',
          content: 'User prefers Python for backend development.',
          confidence: '0.95',
          confidenceType: 'explicit',
          status: 'pending',
          importance: 7,
          rationale: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.processExtractionJob(mockJobId, mockUserId);

      expect(result.job.status).toBe('completed');
      expect(result.extractedCount).toBe(1);
      expect(aiGatewayService.extractMemoryCandidates).not.toHaveBeenCalled();
      expect(repository.claimJob).not.toHaveBeenCalled();
    });

    it('should reject concurrent processing with ConflictException if job is currently processing', async () => {
      repository.findJobById.mockResolvedValue({
        ...mockPendingJob,
        status: 'processing',
      });

      await expect(service.processExtractionJob(mockJobId, mockUserId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject processing if job has exceeded maxRetries', async () => {
      repository.findJobById.mockResolvedValue({
        ...mockPendingJob,
        status: 'failed',
        retryCount: 3,
        maxRetries: 3,
      });

      await expect(service.processExtractionJob(mockJobId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should increment retryCount and set status to failed if AI service throws an error', async () => {
      repository.findJobById.mockResolvedValue(mockPendingJob);
      repository.claimJob.mockResolvedValue({ ...mockPendingJob, status: 'processing' });
      repository.findRecentConversationMessages.mockResolvedValue([]);

      aiGatewayService.extractMemoryCandidates.mockRejectedValue(
        new BadGatewayException('FastAPI connection timed out'),
      );

      await expect(service.processExtractionJob(mockJobId, mockUserId)).rejects.toThrow(
        BadGatewayException,
      );

      expect(repository.updateJob).toHaveBeenCalledWith(
        mockJobId,
        mockUserId,
        expect.objectContaining({
          status: 'failed',
          retryCount: 1,
          lastError: 'FastAPI connection timed out',
        }),
      );
    });

    it('should filter out malformed candidates and persist only valid ones', async () => {
      repository.findJobById.mockResolvedValue(mockPendingJob);
      repository.claimJob.mockResolvedValue({ ...mockPendingJob, status: 'processing' });
      repository.findRecentConversationMessages.mockResolvedValue([]);

      // One valid, one invalid category, one invalid confidence (> 1.0)
      aiGatewayService.extractMemoryCandidates.mockResolvedValue({
        candidates: [
          {
            category: 'user_preference',
            content: 'User prefers dark roast coffee.',
            confidence: 0.90,
            confidenceType: 'explicit',
            importance: 6,
          },
          {
            category: 'invalid_category',
            content: 'Malformed category test',
            confidence: 0.80,
            confidenceType: 'explicit',
          },
          {
            category: 'semantic_fact',
            content: 'Invalid confidence test',
            confidence: 1.50, // Out of bounds
            confidenceType: 'explicit',
          },
        ],
        provider: 'mock',
        model: 'niva-mock-companion-v1',
        latencyMs: 15.0,
        requestId: `job-${mockJobId}`,
        extractedCount: 3,
      });

      repository.createCandidates.mockResolvedValue([
        {
          id: 'cand-valid',
          userId: mockUserId,
          jobId: mockJobId,
          sourceConversationId: mockConversationId,
          sourceMessageId: mockMessageId,
          category: 'user_preference',
          content: 'User prefers dark roast coffee.',
          confidence: '0.90',
          confidenceType: 'explicit',
          status: 'pending',
          importance: 6,
          rationale: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      repository.updateJob.mockResolvedValue({
        ...mockPendingJob,
        status: 'completed',
        completedAt: new Date(),
      });

      const result = await service.processExtractionJob(mockJobId, mockUserId);

      // Only the 1 valid candidate should be inserted
      expect(repository.createCandidates).toHaveBeenCalledWith([
        expect.objectContaining({
          category: 'user_preference',
          content: 'User prefers dark roast coffee.',
        }),
      ]);
      expect(result.extractedCount).toBe(1);
    });
  });

  // ============================================================================
  // EMBEDDING GENERATION & PERSISTENCE
  // ============================================================================
  describe('generateAndPersistEmbedding', () => {
    it('should generate and persist 768-dim embedding for durable memory', async () => {
      repository.findMemoryById.mockResolvedValue({
        id: mockMemoryId,
        userId: mockUserId,
        content: 'User prefers Python for software development.',
        category: 'user_preference',
        status: 'active',
      });

      const dummyVector = Array(768).fill(0.015);
      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummyVector,
        provider: 'mock',
        model: 'mock-embedding-v1',
        dimensions: 768,
        latencyMs: 12.0,
        requestId: `emb-${mockMemoryId}`,
      });

      const now = new Date();
      repository.upsertMemoryEmbedding.mockResolvedValue({
        id: 'emb-123',
        memoryId: mockMemoryId,
        userId: mockUserId,
        embedding: dummyVector,
        provider: 'mock',
        model: 'mock-embedding-v1',
        dimensions: 768,
        metadata: { latencyMs: 12.0 },
        createdAt: now,
      });

      const result = await service.generateAndPersistEmbedding(mockUserId, mockMemoryId);

      expect(result.id).toBe('emb-123');
      expect(result.dimensions).toBe(768);
      expect(result.provider).toBe('mock');
      expect(repository.upsertMemoryEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId: mockMemoryId,
          userId: mockUserId,
          dimensions: 768,
          embedding: dummyVector,
        }),
      );
    });

    it('should throw NotFoundException if durable memory is not found or owned by another user', async () => {
      repository.findMemoryById.mockResolvedValue(null);

      await expect(
        service.generateAndPersistEmbedding(otherUserId, mockMemoryId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject embedding if dimension does not match 768', async () => {
      repository.findMemoryById.mockResolvedValue({
        id: mockMemoryId,
        userId: mockUserId,
        content: 'User prefers Python.',
      });

      // Returning 512 dimensions instead of 768
      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: Array(512).fill(0.1),
        provider: 'third-party',
        model: 'wrong-model',
        dimensions: 512,
        latencyMs: 10.0,
        requestId: `emb-${mockMemoryId}`,
      });

      await expect(
        service.generateAndPersistEmbedding(mockUserId, mockMemoryId),
      ).rejects.toThrow(BadGatewayException);
      expect(repository.upsertMemoryEmbedding).not.toHaveBeenCalled();
    });
  });
});
