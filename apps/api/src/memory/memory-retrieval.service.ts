import { Injectable, Logger } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import { AiGatewayService } from '../ai/ai-gateway.service';
import {
  RelevantMemoryDto,
  MemoryRetrievalOptions,
  MemoryRetrievalResultDto,
  MemoryCategory,
  ConfidenceType,
} from '@niva/shared-types';
import { Memory } from '../database/schema';

@Injectable()
export class MemoryRetrievalService {
  private readonly logger = new Logger(MemoryRetrievalService.name);

  constructor(
    private readonly repository: MemoryRepository,
    private readonly aiGatewayService: AiGatewayService,
  ) {}

  /**
   * Deterministic token estimation heuristic: 4 characters per token.
   */
  private estimateTokens(payload: unknown): number {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return Math.ceil(str.length / 4);
  }

  /**
   * Normalizes text into a set of lowercased word tokens for lexical comparison.
   */
  private getWordTokens(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return new Set(words);
  }

  /**
   * Computes Jaccard similarity between two token sets.
   */
  private computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Computes deterministic hybrid ranking score S_final in [0, 1].
   * Weights:
   *   w_sim  = 0.50 (Cosine similarity)
   *   w_imp  = 0.20 (Importance score / 10)
   *   w_conf = 0.15 (Confidence adjusted by confidenceType)
   *   w_rec  = 0.15 (Recency decay + reinforcement boost)
   */
  private computeRelevanceScore(
    memory: Memory & { similarity: number },
    nowMs: number,
    halfLifeDays = 30,
  ): number {
    // 1. Vector similarity S_sim in [0, 1]
    const sSim = Math.max(0, Math.min(1, memory.similarity));

    // 2. Importance score S_imp in [0.1, 1.0] (importance ranges 1..10)
    const rawImportance = Number(memory.importance);
    const importanceVal = !isNaN(rawImportance) ? rawImportance : 5;
    const sImp = Math.max(0.1, Math.min(1.0, importanceVal / 10));

    // 3. Confidence & Type score S_conf in [0, 1]
    const rawConfidence = typeof memory.confidence === 'number' ? memory.confidence : parseFloat(memory.confidence as any);
    const confVal = !isNaN(rawConfidence) ? rawConfidence : 0.8;
    const typeMultiplier = memory.confidenceType === 'explicit' ? 1.0 : 0.90;
    const sConf = Math.max(0, Math.min(1.0, confVal * typeMultiplier));

    // 4. Recency & Reinforcement S_rec in [0, 1]
    const refDate = memory.lastReinforcedAt
      ? new Date(memory.lastReinforcedAt)
      : new Date(memory.createdAt);
    const elapsedDays = Math.max(0, (nowMs - refDate.getTime()) / (1000 * 60 * 60 * 24));
    const timeDecay = Math.pow(0.5, elapsedDays / (halfLifeDays || 30));

    const rCount = memory.reinforcementCount && memory.reinforcementCount > 0 ? memory.reinforcementCount : 1;
    // Normalized reinforcement score: log(1 + r) / log(11) -> 10 reinforcements yields 1.0
    const reinforcementScore = Math.min(1.0, Math.log(1 + rCount) / Math.log(11));

    const sRec = Math.max(0, Math.min(1.0, 0.60 * timeDecay + 0.40 * reinforcementScore));

    // Final weighted score
    const sFinal = 0.50 * sSim + 0.20 * sImp + 0.15 * sConf + 0.15 * sRec;
    return Math.max(0, Math.min(1.0, Math.round(sFinal * 10000) / 10000));
  }

  /**
   * Retrieves relevant durable memories for an interaction with graceful degradation.
   *
   * @param userId Authenticated user UUID (strict isolation)
   * @param queryText Interaction query text (e.g. current user message)
   * @param options Retrieval tuning parameters
   */
  async retrieveRelevantMemories(
    userId: string,
    queryText: string,
    options?: MemoryRetrievalOptions,
  ): Promise<MemoryRetrievalResultDto> {
    const startTime = performance.now();

    if (!userId || !queryText || !queryText.trim()) {
      return {
        memories: [],
        totalRetrieved: 0,
        tokenCountEstimated: 0,
        queryLatencyMs: 0,
      };
    }

    const trimmedQuery = queryText.trim();
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.60;
    const maxTokens = options?.maxTokens ?? 400;

    try {
      // 1. Generate transient query embedding (never persisted to DB)
      const embeddingResult = await this.aiGatewayService.generateEmbedding({
        text: trimmedQuery,
        requestId: `retrieve-${userId.slice(0, 8)}-${Date.now()}`,
      });

      if (!embeddingResult || !embeddingResult.embedding || embeddingResult.embedding.length === 0) {
        this.logger.warn(`Query embedding generation returned empty for user ${userId}. Gracefully degrading.`);
        return {
          memories: [],
          totalRetrieved: 0,
          tokenCountEstimated: 0,
          queryLatencyMs: Math.round(performance.now() - startTime),
        };
      }

      // 2. Fetch candidate memories from repository (pgvector cosine search, scoped strictly to user)
      // Fetch up to 2x limit to allow lexical duplicate suppression and hybrid re-ranking
      const candidateFetchLimit = Math.max(limit * 2, 10);
      const rawCandidates = await this.repository.findSimilarMemories(
        userId,
        embeddingResult.embedding,
        candidateFetchLimit,
        minSimilarity,
      );

      if (!rawCandidates || rawCandidates.length === 0) {
        return {
          memories: [],
          totalRetrieved: 0,
          tokenCountEstimated: 0,
          queryLatencyMs: Math.round(performance.now() - startTime),
        };
      }

      // 3. Compute deterministic hybrid ranking scores
      const nowMs = Date.now();
      const scoredCandidates = rawCandidates.map((mem) => ({
        memory: mem,
        score: this.computeRelevanceScore(mem, nowMs),
      }));

      // Sort descending by relevance score
      scoredCandidates.sort((a, b) => b.score - a.score);

      // 4. Lexical duplicate suppression & token budget enforcement
      const acceptedMemories: RelevantMemoryDto[] = [];
      const acceptedWordTokenSets: Array<Set<string>> = [];
      let totalTokens = 0;

      for (const item of scoredCandidates) {
        if (acceptedMemories.length >= limit) {
          break;
        }

        const content = item.memory.content;
        const currentTokens = this.getWordTokens(content);

        // Check lexical similarity against already accepted memories
        let isDuplicate = false;
        for (const existingSet of acceptedWordTokenSets) {
          const jaccard = this.computeJaccardSimilarity(currentTokens, existingSet);
          if (jaccard >= 0.75) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          this.logger.debug(
            `Suppressing lexical duplicate memory ${item.memory.id}: "${content.slice(0, 40)}..."`,
          );
          continue;
        }

        const lastReinforcedDate = item.memory.lastReinforcedAt
          ? new Date(item.memory.lastReinforcedAt)
          : new Date(item.memory.createdAt);
        const createdDate = new Date(item.memory.createdAt);

        // Estimate tokens for this candidate
        const memoryDto: RelevantMemoryDto = {
          id: item.memory.id,
          category: item.memory.category as MemoryCategory,
          content: item.memory.content,
          confidence:
            typeof item.memory.confidence === 'number'
              ? item.memory.confidence
              : parseFloat(item.memory.confidence as any),
          confidenceType: item.memory.confidenceType as ConfidenceType,
          importance: Number(item.memory.importance),
          relevanceScore: item.score,
          similarity: Math.round(item.memory.similarity * 10000) / 10000,
          lastReinforcedAt: lastReinforcedDate.toISOString(),
          createdAt: createdDate.toISOString(),
        };

        const itemTokenEstimate = this.estimateTokens(memoryDto.content);

        // Enforce token budget
        if (acceptedMemories.length > 0 && totalTokens + itemTokenEstimate > maxTokens) {
          this.logger.debug(
            `Memory ${item.memory.id} truncated due to token budget (${totalTokens + itemTokenEstimate} > ${maxTokens})`,
          );
          continue;
        }

        acceptedMemories.push(memoryDto);
        acceptedWordTokenSets.push(currentTokens);
        totalTokens += itemTokenEstimate;
      }

      const totalEstimatedTokens = this.estimateTokens(acceptedMemories);
      const queryLatencyMs = Math.round(performance.now() - startTime);

      return {
        memories: acceptedMemories,
        totalRetrieved: acceptedMemories.length,
        tokenCountEstimated: totalEstimatedTokens,
        queryLatencyMs,
      };
    } catch (error: any) {
      // Graceful degradation: never fail the caller or conversation turn
      this.logger.warn(
        `Memory retrieval failed gracefully for user ${userId}: ${error?.message || error}. Proceeding with empty memories.`,
      );
      return {
        memories: [],
        totalRetrieved: 0,
        tokenCountEstimated: 0,
        queryLatencyMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
