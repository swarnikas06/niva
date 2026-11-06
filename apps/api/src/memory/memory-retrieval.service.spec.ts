import { Test, TestingModule } from '@nestjs/testing';
import { MemoryRetrievalService } from './memory-retrieval.service';
import { MemoryRepository } from './memory.repository';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { Memory } from '../database/schema';

describe('MemoryRetrievalService', () => {
  let service: MemoryRetrievalService;
  let repository: jest.Mocked<MemoryRepository>;
  let aiGatewayService: jest.Mocked<AiGatewayService>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '99999999-9999-9999-9999-999999999999';

  const mockMemory1: Memory & { similarity: number } = {
    id: 'mem-1',
    userId: mockUserId,
    candidateId: 'cand-1',
    category: 'user_preference',
    content: 'User prefers dark roast pour-over coffee with oat milk',
    confidence: '0.95' as any,
    confidenceType: 'explicit',
    status: 'active',
    sourceType: 'conversation',
    sourceConversationId: 'conv-1',
    sourceMessageId: 'msg-1',
    supersededById: null,
    reinforcementCount: 3,
    lastReinforcedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    validFrom: new Date(),
    validUntil: null,
    importance: 8,
    metadata: {},
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    similarity: 0.88,
  };

  const mockMemory2: Memory & { similarity: number } = {
    id: 'mem-2',
    userId: mockUserId,
    candidateId: 'cand-2',
    category: 'semantic_fact',
    content: 'User works as a senior software architect specializing in distributed databases',
    confidence: '0.85' as any,
    confidenceType: 'inferred',
    status: 'active',
    sourceType: 'conversation',
    sourceConversationId: 'conv-1',
    sourceMessageId: 'msg-2',
    supersededById: null,
    reinforcementCount: 1,
    lastReinforcedAt: null,
    validFrom: new Date(),
    validUntil: null,
    importance: 6,
    metadata: {},
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    similarity: 0.75,
  };

  beforeEach(async () => {
    const mockRepo = {
      findSimilarMemories: jest.fn(),
    };

    const mockAiGateway = {
      generateEmbedding: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.05),
        latencyMs: 15,
        provider: 'mock',
        model: 'mock-embedding',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryRetrievalService,
        { provide: MemoryRepository, useValue: mockRepo },
        { provide: AiGatewayService, useValue: mockAiGateway },
      ],
    }).compile();

    service = module.get<MemoryRetrievalService>(MemoryRetrievalService);
    repository = module.get(MemoryRepository);
    aiGatewayService = module.get(AiGatewayService);
  });

  describe('retrieveRelevantMemories', () => {
    it('returns empty result immediately if query text is empty or whitespace', async () => {
      const result = await service.retrieveRelevantMemories(mockUserId, '   ');
      expect(result.memories).toEqual([]);
      expect(result.totalRetrieved).toBe(0);
      expect(result.tokenCountEstimated).toBe(0);
      expect(aiGatewayService.generateEmbedding).not.toHaveBeenCalled();
      expect(repository.findSimilarMemories).not.toHaveBeenCalled();
    });

    it('generates transient query embedding and retrieves candidate memories strictly scoped to user', async () => {
      repository.findSimilarMemories.mockResolvedValueOnce([mockMemory1, mockMemory2]);

      const result = await service.retrieveRelevantMemories(mockUserId, 'What coffee do I prefer?');

      expect(aiGatewayService.generateEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'What coffee do I prefer?',
        }),
      );
      expect(repository.findSimilarMemories).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Array),
        10, // candidate limit Math.max(limit * 2, 10)
        0.6, // minSimilarity
      );
      expect(result.memories.length).toBe(2);
      expect(result.totalRetrieved).toBe(2);
      expect(result.memories[0].id).toBe('mem-1');
      expect(result.memories[0].content).toContain('dark roast pour-over coffee');
      expect(result.memories[0].relevanceScore).toBeGreaterThan(result.memories[1].relevanceScore);
      expect(result.tokenCountEstimated).toBeGreaterThan(0);
    });

    it('applies deterministic hybrid ranking formula accurately', async () => {
      // Memory A: high similarity, high importance, high confidence explicit
      // Memory B: lower similarity, lower importance
      repository.findSimilarMemories.mockResolvedValueOnce([mockMemory2, mockMemory1]); // returned unordered

      const result = await service.retrieveRelevantMemories(mockUserId, 'coffee preference');

      // Regardless of repo return order, mem-1 must rank first due to higher hybrid score
      expect(result.memories[0].id).toBe('mem-1');
      expect(result.memories[1].id).toBe('mem-2');
      expect(result.memories[0].relevanceScore).toBeGreaterThan(result.memories[1].relevanceScore);
      expect(result.memories[0].relevanceScore).toBeLessThanOrEqual(1.0);
      expect(result.memories[0].relevanceScore).toBeGreaterThanOrEqual(0.0);
    });

    it('suppresses lexical duplicates with high token overlap', async () => {
      const duplicateMemory: Memory & { similarity: number } = {
        ...mockMemory1,
        id: 'mem-dup',
        content: 'User prefers dark roast pour-over coffee with some oat milk', // almost identical
        similarity: 0.86,
        importance: 7,
      };

      repository.findSimilarMemories.mockResolvedValueOnce([mockMemory1, duplicateMemory]);

      const result = await service.retrieveRelevantMemories(mockUserId, 'coffee preferences');

      // The duplicate should be suppressed
      expect(result.memories.length).toBe(1);
      expect(result.memories[0].id).toBe('mem-1');
    });

    it('enforces token budget constraint properly', async () => {
      const longMemory: Memory & { similarity: number } = {
        ...mockMemory1,
        id: 'mem-long',
        content: 'A'.repeat(800), // ~200 tokens
        similarity: 0.90,
      };

      const secondMemory: Memory & { similarity: number } = {
        ...mockMemory2,
        id: 'mem-second',
        content: 'B'.repeat(800), // ~200 tokens
        similarity: 0.85,
      };

      repository.findSimilarMemories.mockResolvedValueOnce([longMemory, secondMemory]);

      // Set maxTokens to 150 -> only the first memory should fit, second should be skipped
      const result = await service.retrieveRelevantMemories(mockUserId, 'query', {
        maxTokens: 150,
      });

      expect(result.memories.length).toBe(1);
      expect(result.memories[0].id).toBe('mem-long');
    });

    it('gracefully degrades and returns empty array if AI gateway embedding generation fails', async () => {
      aiGatewayService.generateEmbedding.mockRejectedValueOnce(
        new Error('AI Gateway 503 Service Unavailable'),
      );

      const result = await service.retrieveRelevantMemories(mockUserId, 'coffee preferences');

      expect(result.memories).toEqual([]);
      expect(result.totalRetrieved).toBe(0);
      expect(result.tokenCountEstimated).toBe(0);
      expect(repository.findSimilarMemories).not.toHaveBeenCalled();
    });

    it('gracefully degrades and returns empty array if database vector query fails', async () => {
      repository.findSimilarMemories.mockRejectedValueOnce(
        new Error('PostgreSQL connection timeout'),
      );

      const result = await service.retrieveRelevantMemories(mockUserId, 'coffee preferences');

      expect(result.memories).toEqual([]);
      expect(result.totalRetrieved).toBe(0);
      expect(result.tokenCountEstimated).toBe(0);
    });

    it('isolates users strictly: vector query passes authenticated userId', async () => {
      repository.findSimilarMemories.mockResolvedValueOnce([]);

      await service.retrieveRelevantMemories(otherUserId, 'isolated user query');

      expect(repository.findSimilarMemories).toHaveBeenCalledWith(
        otherUserId,
        expect.any(Array),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});
