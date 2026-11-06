import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray, sql, ilike } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  MemoryExtractionJob,
  NewMemoryExtractionJob,
  MemoryCandidate,
  NewMemoryCandidate,
  Memory,
  NewMemory,
  MemoryEmbedding,
  NewMemoryEmbedding,
  Conversation,
  ConversationMessage,
} from '../database/schema';
import { MemoryCategory } from '@niva/shared-types';

@Injectable()
export class MemoryRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ============================================================================
  // EXTRACTION JOBS
  // ============================================================================

  async createJob(data: NewMemoryExtractionJob): Promise<MemoryExtractionJob> {
    const [job] = await this.db
      .insert(schema.memoryExtractionJobs)
      .values(data)
      .returning();
    if (!job) {
      throw new Error('Failed to create memory extraction job');
    }
    return job;
  }

  async findJobById(jobId: string, userId: string): Promise<MemoryExtractionJob | null> {
    const [job] = await this.db
      .select()
      .from(schema.memoryExtractionJobs)
      .where(
        and(
          eq(schema.memoryExtractionJobs.id, jobId),
          eq(schema.memoryExtractionJobs.userId, userId),
        ),
      )
      .limit(1);
    return job || null;
  }

  async findJobsByUser(
    userId: string,
    filter?: { status?: string; limit?: number },
  ): Promise<MemoryExtractionJob[]> {
    const conditions = [eq(schema.memoryExtractionJobs.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.memoryExtractionJobs.status, filter.status as any));
    }

    const limit = filter?.limit || 20;

    return this.db
      .select()
      .from(schema.memoryExtractionJobs)
      .where(and(...conditions))
      .orderBy(desc(schema.memoryExtractionJobs.createdAt))
      .limit(limit);
  }

  /**
   * Finds all pending or retryable failed jobs across all users for background processing.
   */
  async findPendingJobs(limit = 10): Promise<MemoryExtractionJob[]> {
    return this.db
      .select()
      .from(schema.memoryExtractionJobs)
      .where(
        and(
          eq(schema.memoryExtractionJobs.status, 'pending'),
          sql`${schema.memoryExtractionJobs.retryCount} < ${schema.memoryExtractionJobs.maxRetries}`,
        ),
      )
      .orderBy(desc(schema.memoryExtractionJobs.createdAt))
      .limit(limit);
  }

  /**
   * Recovers jobs stuck in 'processing' state (e.g. following process restart or crash).
   */
  async recoverStuckJobs(olderThanMinutes = 2): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const result = await this.db
      .update(schema.memoryExtractionJobs)
      .set({
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.memoryExtractionJobs.status, 'processing'),
          sql`${schema.memoryExtractionJobs.updatedAt} < ${cutoff}`,
        ),
      )
      .returning();
    return result.length;
  }

  /**
   * Atomic Claim: Transition job status to 'processing' only if it is currently
   * 'pending' or 'failed' (with retries remaining), preventing race conditions
   * and concurrent duplicate processing.
   */
  async claimJob(jobId: string, userId: string): Promise<MemoryExtractionJob | null> {
    const [claimed] = await this.db
      .update(schema.memoryExtractionJobs)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.memoryExtractionJobs.id, jobId),
          eq(schema.memoryExtractionJobs.userId, userId),
          inArray(schema.memoryExtractionJobs.status, ['pending', 'failed']),
          sql`${schema.memoryExtractionJobs.retryCount} < ${schema.memoryExtractionJobs.maxRetries}`,
        ),
      )
      .returning();

    return claimed || null;
  }

  async updateJob(
    jobId: string,
    userId: string,
    updateData: Partial<NewMemoryExtractionJob>,
  ): Promise<MemoryExtractionJob> {
    const [updated] = await this.db
      .update(schema.memoryExtractionJobs)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.memoryExtractionJobs.id, jobId),
          eq(schema.memoryExtractionJobs.userId, userId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(`Failed to update job ${jobId}`);
    }

    return updated;
  }

  // ============================================================================
  // MEMORY CANDIDATES
  // ============================================================================

  async createCandidates(candidates: Array<NewMemoryCandidate>): Promise<MemoryCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }
    return this.db
      .insert(schema.memoryCandidates)
      .values(candidates)
      .returning();
  }

  async findCandidatesByUser(
    userId: string,
    filter?: { status?: string; category?: string; limit?: number },
  ): Promise<MemoryCandidate[]> {
    const conditions = [eq(schema.memoryCandidates.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.memoryCandidates.status, filter.status as any));
    }
    if (filter?.category) {
      conditions.push(eq(schema.memoryCandidates.category, filter.category as any));
    }

    const limit = filter?.limit || 50;

    return this.db
      .select()
      .from(schema.memoryCandidates)
      .where(and(...conditions))
      .orderBy(desc(schema.memoryCandidates.createdAt))
      .limit(limit);
  }

  async findCandidateById(candidateId: string, userId: string): Promise<MemoryCandidate | null> {
    const [cand] = await this.db
      .select()
      .from(schema.memoryCandidates)
      .where(
        and(
          eq(schema.memoryCandidates.id, candidateId),
          eq(schema.memoryCandidates.userId, userId),
        ),
      )
      .limit(1);

    return cand || null;
  }

  async updateCandidate(
    candidateId: string,
    userId: string,
    updateData: Partial<NewMemoryCandidate>,
  ): Promise<MemoryCandidate> {
    const [updated] = await this.db
      .update(schema.memoryCandidates)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.memoryCandidates.id, candidateId),
          eq(schema.memoryCandidates.userId, userId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(`Failed to update candidate ${candidateId}`);
    }

    return updated;
  }


  // ============================================================================
  // DURABLE MEMORIES
  // ============================================================================

  async findMemoryById(memoryId: string, userId: string): Promise<Memory | null> {
    const [memory] = await this.db
      .select()
      .from(schema.memories)
      .where(
        and(
          eq(schema.memories.id, memoryId),
          eq(schema.memories.userId, userId),
        ),
      )
      .limit(1);

    return memory || null;
  }

  async findMemories(
    userId: string,
    filter?: {
      status?: string;
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Memory[]> {
    const conditions = [eq(schema.memories.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.memories.status, filter.status as any));
    } else {
      conditions.push(eq(schema.memories.status, 'active'));
    }

    if (filter?.category) {
      conditions.push(eq(schema.memories.category, filter.category as any));
    }

    if (filter?.search && filter.search.trim()) {
      conditions.push(ilike(schema.memories.content, `%${filter.search.trim()}%`));
    }

    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    return this.db
      .select()
      .from(schema.memories)
      .where(and(...conditions))
      .orderBy(desc(schema.memories.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countMemories(
    userId: string,
    filter?: { status?: string; category?: string; search?: string },
  ): Promise<number> {
    const conditions = [eq(schema.memories.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.memories.status, filter.status as any));
    } else {
      conditions.push(eq(schema.memories.status, 'active'));
    }

    if (filter?.category) {
      conditions.push(eq(schema.memories.category, filter.category as any));
    }

    if (filter?.search && filter.search.trim()) {
      conditions.push(ilike(schema.memories.content, `%${filter.search.trim()}%`));
    }

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.memories)
      .where(and(...conditions));

    return row?.count || 0;
  }

  async archiveMemory(memoryId: string, userId: string): Promise<Memory | null> {
    const [archived] = await this.db
      .update(schema.memories)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.memories.id, memoryId),
          eq(schema.memories.userId, userId),
        ),
      )
      .returning();

    return archived || null;
  }

  async executeMemoryAcceptanceTransaction(params: {
    candidateId: string;
    userId: string;
    memoryData: NewMemory;
    supersedesMemoryId?: string | null;
  }): Promise<{ memory: Memory; candidate: MemoryCandidate }> {
    return await this.db.transaction(async (tx) => {
      // 1. Insert new memory
      const [memory] = await tx
        .insert(schema.memories)
        .values(params.memoryData)
        .returning();

      if (!memory) {
        throw new Error('Failed to insert memory in transaction');
      }

      // 2. If superseding an existing memory, update the older memory
      if (params.supersedesMemoryId) {
        const [superseded] = await tx
          .update(schema.memories)
          .set({
            status: 'superseded',
            supersededById: memory.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.memories.id, params.supersedesMemoryId),
              eq(schema.memories.userId, params.userId),
            ),
          )
          .returning();

        if (!superseded) {
          throw new Error(
            `Failed to supersede memory ${params.supersedesMemoryId}: not found or not owned by user`,
          );
        }
      }

      // 3. Update candidate status to 'accepted'
      const [candidate] = await tx
        .update(schema.memoryCandidates)
        .set({
          status: 'accepted',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.memoryCandidates.id, params.candidateId),
            eq(schema.memoryCandidates.userId, params.userId),
          ),
        )
        .returning();

      if (!candidate) {
        throw new Error(`Failed to update candidate ${params.candidateId} to accepted`);
      }

      return { memory, candidate };
    });
  }

  async reinforceMemory(memoryId: string, userId: string): Promise<Memory | null> {
    const [reinforced] = await this.db
      .update(schema.memories)
      .set({
        reinforcementCount: sql`${schema.memories.reinforcementCount} + 1`,
        lastReinforcedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.memories.id, memoryId),
          eq(schema.memories.userId, userId),
        ),
      )
      .returning();

    return reinforced || null;
  }

  async findSimilarMemories(
    userId: string,
    embedding: number[],
    limit = 5,
    minSimilarity = 0.65,
    category?: MemoryCategory,
  ): Promise<Array<Memory & { similarity: number }>> {
    const vectorStr = `[${embedding.join(',')}]`;
    const categoryClause = category ? sql`AND m.category = ${category}` : sql``;
    const result = await this.db.execute(sql`
      SELECT 
        m.id,
        m.user_id as "userId",
        m.candidate_id as "candidateId",
        m.category,
        m.content,
        m.confidence,
        m.confidence_type as "confidenceType",
        m.status,
        m.source_type as "sourceType",
        m.source_conversation_id as "sourceConversationId",
        m.source_message_id as "sourceMessageId",
        m.superseded_by_id as "supersededById",
        m.reinforcement_count as "reinforcementCount",
        m.last_reinforced_at as "lastReinforcedAt",
        m.valid_from as "validFrom",
        m.valid_until as "validUntil",
        m.importance,
        m.metadata,
        m.created_at as "createdAt",
        m.updated_at as "updatedAt",
        (1 - (me.embedding <=> ${vectorStr}::vector)) as similarity
      FROM memories m
      JOIN memory_embeddings me ON m.id = me.memory_id
      WHERE m.user_id = ${userId}
        AND m.status = 'active'
        AND (1 - (me.embedding <=> ${vectorStr}::vector)) >= ${minSimilarity}
        ${categoryClause}
      ORDER BY me.embedding <=> ${vectorStr}::vector ASC
      LIMIT ${limit}
    `);

    const rows = ((result as any).rows || result) as any[];
    return rows.map((r: any) => ({
      ...r,
      confidence: parseFloat(r.confidence),
      similarity: parseFloat(r.similarity),
    }));
  }


  // ============================================================================
  // MEMORY EMBEDDINGS
  // ============================================================================

  async upsertMemoryEmbedding(data: NewMemoryEmbedding): Promise<MemoryEmbedding> {
    const [embedding] = await this.db
      .insert(schema.memoryEmbeddings)
      .values(data)
      .onConflictDoUpdate({
        target: schema.memoryEmbeddings.memoryId,
        set: {
          embedding: data.embedding,
          provider: data.provider,
          model: data.model,
          dimensions: data.dimensions,
          metadata: data.metadata,
          createdAt: new Date(),
        },
      })
      .returning();

    if (!embedding) {
      throw new Error(`Failed to upsert embedding for memory ${data.memoryId}`);
    }

    return embedding;
  }

  async findEmbeddingByMemoryId(memoryId: string, userId: string): Promise<MemoryEmbedding | null> {
    const [emb] = await this.db
      .select()
      .from(schema.memoryEmbeddings)
      .where(
        and(
          eq(schema.memoryEmbeddings.memoryId, memoryId),
          eq(schema.memoryEmbeddings.userId, userId),
        ),
      )
      .limit(1);

    return emb || null;
  }

  // ============================================================================
  // CONVERSATION CONTEXT & PERSONA HELPERS
  // ============================================================================

  async findConversationById(conversationId: string, userId: string): Promise<Conversation | null> {
    const [conv] = await this.db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, conversationId),
          eq(schema.conversations.userId, userId),
        ),
      )
      .limit(1);

    return conv || null;
  }

  async findRecentConversationMessages(
    conversationId: string,
    limit = 6,
  ): Promise<ConversationMessage[]> {
    const messages = await this.db
      .select()
      .from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.conversationId, conversationId))
      .orderBy(desc(schema.conversationMessages.sequenceNumber))
      .limit(limit);

    // Return in chronological order
    return messages.reverse();
  }

  async findUserCharacterPersona(userId: string): Promise<{ name: string; archetypeId: string } | null> {
    const [pers] = await this.db
      .select({
        archetypeId: schema.userPersonalization.selectedArchetypeId,
        name: schema.characterArchetypes.name,
      })
      .from(schema.userPersonalization)
      .leftJoin(
        schema.characterArchetypes,
        eq(schema.userPersonalization.selectedArchetypeId, schema.characterArchetypes.id),
      )
      .where(eq(schema.userPersonalization.userId, userId))
      .limit(1);

    if (!pers || !pers.archetypeId) {
      return null;
    }

    return {
      archetypeId: pers.archetypeId,
      name: pers.name || 'The Balanced Anchor',
    };
  }
}
