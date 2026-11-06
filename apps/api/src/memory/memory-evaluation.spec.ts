import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadGatewayException,
} from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { EventPublisherService } from '../events/event-publisher.service';

describe('Phase 3C: MemoryService - Evaluation, Lifecycle, Deduplication & Durable Knowledge', () => {
  let service: MemoryService;
  let repository: Record<string, jest.Mock>;
  let aiGatewayService: Record<string, jest.Mock>;
  let eventPublisher: Record<string, jest.Mock>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';
  const mockCandidateId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockMemoryId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const mockOldMemoryId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const dummy768Embedding = new Array(768).fill(0.036);

  beforeEach(async () => {
    eventPublisher = {
      publish: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
    };

    repository = {
      findCandidateById: jest.fn(),
      updateCandidate: jest.fn(),
      findSimilarMemories: jest.fn(),
      findMemoryById: jest.fn(),
      findMemories: jest.fn(),
      countMemories: jest.fn(),
      executeMemoryAcceptanceTransaction: jest.fn(),
      reinforceMemory: jest.fn(),
      upsertMemoryEmbedding: jest.fn(),
    };

    aiGatewayService = {
      generateEmbedding: jest.fn(),
      evaluateMemoryCandidate: jest.fn(),
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

  describe('Scenario 1: Durable Preference (accept)', () => {
    it('accepts durable preference, atomically creates memory, and persists 768-dim embedding', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode for IDEs and system interfaces.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 7,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 12.5,
        requestId: 'req-embed-1',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'accept',
        reason: 'Durable user preference with high stability',
        confidence: 0.95,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 25.0,
        requestId: 'req-eval-1',
      });

      const fakeMemory = {
        id: mockMemoryId,
        userId: mockUserId,
        candidateId: mockCandidateId,
        category: 'user_preference',
        content: 'User prefers dark mode for IDEs and system interfaces.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'active',
        sourceType: 'conversation',
        reinforcementCount: 1,
        lastReinforcedAt: new Date(),
        importance: 7,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fakeUpdatedCandidate = {
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode for IDEs and system interfaces.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'accepted',
        importance: 7,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.executeMemoryAcceptanceTransaction.mockResolvedValue({
        memory: fakeMemory,
        candidate: fakeUpdatedCandidate,
      });

      repository.upsertMemoryEmbedding.mockResolvedValue({
        id: 'emb-1',
        memoryId: mockMemoryId,
        userId: mockUserId,
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        createdAt: new Date(),
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('accept');
      expect(result.durableMemory).toBeDefined();
      expect(result.durableMemory?.id).toBe(mockMemoryId);
      expect(result.durableMemory?.status).toBe('active');
      expect(result.candidate.status).toBe('accepted');
      expect(result.embeddingCreated).toBe(true);
      expect(repository.executeMemoryAcceptanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: mockCandidateId,
          userId: mockUserId,
          supersedesMemoryId: null,
        }),
      );
      expect(repository.upsertMemoryEmbedding).toHaveBeenCalled();
    });
  });

  describe('Scenario 2: Transient Statement (reject / defer)', () => {
    it('rejects transient physical state without creating durable memory', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'episodic_event',
        content: 'User is having coffee right now and feeling a bit tired.',
        confidence: '0.80',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 3,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 10.0,
        requestId: 'req-embed-2',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'reject',
        reason: 'Transient state with low long-term durability',
        confidence: 0.95,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 20.0,
        requestId: 'req-eval-2',
      });

      repository.updateCandidate.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'episodic_event',
        content: 'User is having coffee right now and feeling a bit tired.',
        confidence: '0.80',
        confidenceType: 'explicit',
        status: 'rejected',
        rejectionReason: 'Transient state with low long-term durability',
        importance: 3,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('reject');
      expect(result.durableMemory).toBeNull();
      expect(result.embeddingCreated).toBe(false);
      expect(result.candidate.status).toBe('rejected');
      expect(repository.executeMemoryAcceptanceTransaction).not.toHaveBeenCalled();
      expect(repository.upsertMemoryEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3: Operational Duplication (reject)', () => {
    it('rejects operational task from becoming durable memory', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'open_loop',
        content: 'TODO: buy milk and submit project assignment tomorrow.',
        confidence: '0.90',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 6,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 11.0,
        requestId: 'req-embed-3',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'reject',
        reason: 'Operational commitment belongs in Life Context',
        confidence: 0.98,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 18.0,
        requestId: 'req-eval-3',
      });

      repository.updateCandidate.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'open_loop',
        content: 'TODO: buy milk and submit project assignment tomorrow.',
        confidence: '0.90',
        confidenceType: 'explicit',
        status: 'rejected',
        rejectionReason: 'Operational commitment belongs in Life Context',
        importance: 6,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('reject');
      expect(result.reason).toContain('Operational');
      expect(result.durableMemory).toBeNull();
      expect(repository.executeMemoryAcceptanceTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4: Duplicate Memory (reject duplicate, reinforce existing)', () => {
    it('identifies semantic duplicate, rejects candidate, and increments reinforcement count of existing memory', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode in their editor.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 10.0,
        requestId: 'req-embed-4',
      });

      repository.findSimilarMemories.mockResolvedValue([
        {
          id: mockMemoryId,
          userId: mockUserId,
          category: 'user_preference',
          content: 'User prefers dark mode for all IDEs and editors.',
          confidence: 0.95,
          confidenceType: 'explicit',
          status: 'active',
          similarity: 0.94,
          reinforcementCount: 1,
          lastReinforcedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'reject',
        reason: `Semantic duplicate of existing active memory ${mockMemoryId}`,
        confidence: 0.95,
        duplicateOfMemoryId: mockMemoryId,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 22.0,
        requestId: 'req-eval-4',
      });

      repository.reinforceMemory.mockResolvedValue({
        id: mockMemoryId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode for all IDEs and editors.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'active',
        reinforcementCount: 2,
        lastReinforcedAt: new Date(),
        importance: 6,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      repository.updateCandidate.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode in their editor.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'rejected',
        rejectionReason: `Semantic duplicate of existing active memory ${mockMemoryId}`,
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('reject');
      expect(result.reinforcedMemory).toBeDefined();
      expect(result.reinforcedMemory?.id).toBe(mockMemoryId);
      expect(result.reinforcedMemory?.reinforcementCount).toBe(2);
      expect(repository.reinforceMemory).toHaveBeenCalledWith(mockMemoryId, mockUserId);
      expect(repository.executeMemoryAcceptanceTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 5: Contradiction & Supersession (supersede old, accept new)', () => {
    it('supersedes old memory and creates new active memory atomically', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'semantic_fact',
        content: 'User now lives in London, United Kingdom.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 8,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 12.0,
        requestId: 'req-embed-5',
      });

      repository.findSimilarMemories.mockResolvedValue([
        {
          id: mockOldMemoryId,
          userId: mockUserId,
          category: 'semantic_fact',
          content: 'User lives in Tokyo, Japan.',
          confidence: 0.95,
          confidenceType: 'explicit',
          status: 'active',
          similarity: 0.72,
          reinforcementCount: 1,
          lastReinforcedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'supersede',
        reason: 'Candidate contradicts and updates prior active residence fact',
        confidence: 0.96,
        supersedesMemoryId: mockOldMemoryId,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 25.0,
        requestId: 'req-eval-5',
      });

      const oldMemoryRow = {
        id: mockOldMemoryId,
        userId: mockUserId,
        category: 'semantic_fact',
        content: 'User lives in Tokyo, Japan.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'active',
        reinforcementCount: 1,
        lastReinforcedAt: new Date(),
        importance: 8,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findMemoryById
        .mockResolvedValueOnce(oldMemoryRow) // check existing memory exists
        .mockResolvedValueOnce({
          ...oldMemoryRow,
          status: 'superseded',
          supersededById: mockMemoryId,
        }); // refresh superseded memory

      const newMemoryRow = {
        id: mockMemoryId,
        userId: mockUserId,
        candidateId: mockCandidateId,
        category: 'semantic_fact',
        content: 'User now lives in London, United Kingdom.',
        confidence: '0.95',
        confidenceType: 'explicit',
        status: 'active',
        sourceType: 'conversation',
        reinforcementCount: 1,
        lastReinforcedAt: new Date(),
        importance: 8,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.executeMemoryAcceptanceTransaction.mockResolvedValue({
        memory: newMemoryRow,
        candidate: {
          id: mockCandidateId,
          userId: mockUserId,
          category: 'semantic_fact',
          content: 'User now lives in London, United Kingdom.',
          confidence: '0.95',
          confidenceType: 'explicit',
          status: 'accepted',
          importance: 8,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      repository.upsertMemoryEmbedding.mockResolvedValue({
        id: 'emb-5',
        memoryId: mockMemoryId,
        userId: mockUserId,
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        createdAt: new Date(),
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('supersede');
      expect(result.durableMemory?.id).toBe(mockMemoryId);
      expect(result.durableMemory?.status).toBe('active');
      expect(result.supersededMemory?.id).toBe(mockOldMemoryId);
      expect(result.supersededMemory?.status).toBe('superseded');
      expect(repository.executeMemoryAcceptanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: mockCandidateId,
          userId: mockUserId,
          supersedesMemoryId: mockOldMemoryId,
        }),
      );
    });
  });

  describe('Scenario 6: Open Loop (accept without task creation)', () => {
    it('accepts intellectual open loop as durable memory with zero operational tasks', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'open_loop',
        content: 'User is considering learning Kubernetes next quarter.',
        confidence: '0.80',
        confidenceType: 'inferred',
        status: 'pending',
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 11.0,
        requestId: 'req-embed-6',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'accept',
        reason: 'Intellectual open loop curiosity worthy of tracking',
        confidence: 0.85,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 20.0,
        requestId: 'req-eval-6',
      });

      repository.executeMemoryAcceptanceTransaction.mockResolvedValue({
        memory: {
          id: mockMemoryId,
          userId: mockUserId,
          candidateId: mockCandidateId,
          category: 'open_loop',
          content: 'User is considering learning Kubernetes next quarter.',
          confidence: '0.80',
          confidenceType: 'inferred',
          status: 'active',
          sourceType: 'conversation',
          reinforcementCount: 1,
          lastReinforcedAt: new Date(),
          importance: 5,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        candidate: {
          id: mockCandidateId,
          userId: mockUserId,
          category: 'open_loop',
          content: 'User is considering learning Kubernetes next quarter.',
          confidence: '0.80',
          confidenceType: 'inferred',
          status: 'accepted',
          importance: 5,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('accept');
      expect(result.durableMemory?.category).toBe('open_loop');
      expect(result.durableMemory?.confidenceType).toBe('inferred');
    });
  });

  describe('Scenario 7: Inferred Information (accept with inferred type)', () => {
    it('accepts inferred preference preserving inferred confidence type', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers strong static typing over dynamic languages.',
        confidence: '0.75',
        confidenceType: 'inferred',
        status: 'pending',
        importance: 6,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 10.0,
        requestId: 'req-embed-7',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockResolvedValue({
        candidateId: mockCandidateId,
        decision: 'accept',
        reason: 'Valid inferred preference based on multi-turn context',
        confidence: 0.75,
        provider: 'mock',
        model: 'niva-companion-v1',
        latencyMs: 21.0,
        requestId: 'req-eval-7',
      });

      repository.executeMemoryAcceptanceTransaction.mockResolvedValue({
        memory: {
          id: mockMemoryId,
          userId: mockUserId,
          candidateId: mockCandidateId,
          category: 'user_preference',
          content: 'User prefers strong static typing over dynamic languages.',
          confidence: '0.75',
          confidenceType: 'inferred',
          status: 'active',
          sourceType: 'conversation',
          reinforcementCount: 1,
          lastReinforcedAt: new Date(),
          importance: 6,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        candidate: {
          id: mockCandidateId,
          userId: mockUserId,
          category: 'user_preference',
          content: 'User prefers strong static typing over dynamic languages.',
          confidence: '0.75',
          confidenceType: 'inferred',
          status: 'accepted',
          importance: 6,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await service.evaluateCandidate(mockCandidateId, mockUserId);

      expect(result.decision).toBe('accept');
      expect(result.durableMemory?.confidenceType).toBe('inferred');
      expect(result.durableMemory?.confidence).toBe(0.75);
    });
  });

  describe('Scenario 8: Provider Failure (graceful error, candidate recoverable)', () => {
    it('leaves candidate recoverable on AI provider error without corrupting state', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode.',
        confidence: '0.90',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 10.0,
        requestId: 'req-embed-8',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockRejectedValue(
        new BadGatewayException('AI Provider evaluation failure'),
      );

      await expect(service.evaluateCandidate(mockCandidateId, mockUserId)).rejects.toThrow(
        BadGatewayException,
      );

      // Verify no memory created and candidate was NOT marked failed/rejected
      expect(repository.executeMemoryAcceptanceTransaction).not.toHaveBeenCalled();
      expect(repository.updateCandidate).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 9: Malformed AI Output (validation failure, no state corruption)', () => {
    it('rejects malformed evaluation output and preserves database integrity', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode.',
        confidence: '0.90',
        confidenceType: 'explicit',
        status: 'pending',
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      aiGatewayService.generateEmbedding.mockResolvedValue({
        embedding: dummy768Embedding,
        provider: 'mock',
        model: 'text-embedding-004',
        dimensions: 768,
        latencyMs: 10.0,
        requestId: 'req-embed-9',
      });

      repository.findSimilarMemories.mockResolvedValue([]);

      aiGatewayService.evaluateMemoryCandidate.mockRejectedValue(
        new BadGatewayException('Malformed candidate evaluation response received from AI service'),
      );

      await expect(service.evaluateCandidate(mockCandidateId, mockUserId)).rejects.toThrow(
        BadGatewayException,
      );

      expect(repository.executeMemoryAcceptanceTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 10: Cross-User Isolation', () => {
    it('prevents User B from evaluating or accessing User A candidate', async () => {
      // User B attempts to access User A's candidate
      repository.findCandidateById.mockResolvedValue(null);

      await expect(service.evaluateCandidate(mockCandidateId, otherUserId)).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.findCandidateById).toHaveBeenCalledWith(mockCandidateId, otherUserId);
      expect(aiGatewayService.evaluateMemoryCandidate).not.toHaveBeenCalled();
    });
  });

  describe('Conflict Prevention on Already Evaluated Candidates', () => {
    it('throws ConflictException if candidate is already accepted', async () => {
      repository.findCandidateById.mockResolvedValue({
        id: mockCandidateId,
        userId: mockUserId,
        category: 'user_preference',
        content: 'User prefers dark mode.',
        confidence: '0.90',
        confidenceType: 'explicit',
        status: 'accepted',
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.evaluateCandidate(mockCandidateId, mockUserId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
