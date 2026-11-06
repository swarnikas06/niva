import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from './schema';
import {
  memoryExtractionJobs,
  memoryCandidates,
  memories,
  memoryEmbeddings,
  users,
  conversations,
  conversationMessages,
} from './schema';

describe('Phase 3A: Persistent Memory Database Foundation', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;

  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://niva_user:niva_dev_password_local_only@localhost:5432/niva_db?schema=public';

  const testUserIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
    });
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    // Cleanup any lingering test users
    for (const userId of testUserIds) {
      try {
        await db.delete(users).where(eq(users.id, userId));
      } catch {
        // ignore cleanup errors
      }
    }
    await pool.end();
  });

  async function createTestUser(suffix: string): Promise<schema.User> {
    const [user] = await db
      .insert(users)
      .values({
        email: `test-memory-${Date.now()}-${suffix}@example.com`,
        name: `Test Memory User ${suffix}`,
        passwordHash: 'dummy_hash',
      })
      .returning();
    testUserIds.push(user.id);
    return user;
  }

  async function createTestConversation(userId: string): Promise<schema.Conversation> {
    const [conv] = await db
      .insert(conversations)
      .values({
        userId,
        characterId: 'niva_anchor',
        title: 'Memory Test Conversation',
      })
      .returning();
    return conv;
  }

  async function createTestMessage(
    conversationId: string,
    role: 'user' | 'assistant' = 'user',
    content = 'Hello, my favorite food is sushi.',
  ): Promise<schema.ConversationMessage> {
    const [msg] = await db
      .insert(conversationMessages)
      .values({
        conversationId,
        senderRole: role,
        content,
        sequenceNumber: 1,
      })
      .returning();
    return msg;
  }

  // ============================================================================
  // Requirement 11: Migration Correctness & Table Existence
  // ============================================================================
  describe('Requirement 11: Migration Correctness & Table Existence', () => {
    it('should have executed migration 0006_create_memory_schema.sql', async () => {
      const res = await pool.query(
        'SELECT name, executed_at FROM _niva_migrations WHERE name = $1',
        ['0006_create_memory_schema.sql'],
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].name).toBe('0006_create_memory_schema.sql');
    });

    it('should have all 4 memory tables present in public schema', async () => {
      const res = await pool.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name IN ('memory_extraction_jobs', 'memory_candidates', 'memories', 'memory_embeddings')
         ORDER BY table_name;`,
      );
      const tableNames = res.rows.map((r: { table_name: string }) => r.table_name);
      expect(tableNames).toContain('memory_candidates');
      expect(tableNames).toContain('memory_embeddings');
      expect(tableNames).toContain('memory_extraction_jobs');
      expect(tableNames).toContain('memories');
    });
  });

  // ============================================================================
  // Requirement 1 & 2: Memory Candidates Creation, Fields & Lifecycle
  // ============================================================================
  describe('Requirements 1 & 2: Memory Candidates Creation, Fields & Lifecycle', () => {
    it('should insert a candidate with all fields, defaults, and relations', async () => {
      const user = await createTestUser('cand-fields');
      const conv = await createTestConversation(user.id);
      const msg = await createTestMessage(conv.id);

      const [candidate] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          sourceConversationId: conv.id,
          sourceMessageId: msg.id,
          category: 'user_preference',
          content: 'User prefers dark roast coffee with oat milk.',
          confidence: '0.90',
          confidenceType: 'explicit',
          importance: 7,
          rationale: 'User directly stated preference in morning routine discussion.',
          metadata: { context: 'breakfast', confirmed: true },
        })
        .returning();

      expect(candidate).toBeDefined();
      expect(candidate.id).toBeDefined();
      expect(candidate.userId).toBe(user.id);
      expect(candidate.category).toBe('user_preference');
      expect(candidate.content).toBe('User prefers dark roast coffee with oat milk.');
      expect(candidate.confidence).toBe('0.90');
      expect(candidate.confidenceType).toBe('explicit');
      expect(candidate.status).toBe('pending'); // default
      expect(candidate.importance).toBe(7);
      expect(candidate.rationale).toBe('User directly stated preference in morning routine discussion.');
      expect(candidate.metadata).toEqual({ context: 'breakfast', confirmed: true });
      expect(candidate.createdAt).toBeInstanceOf(Date);
      expect(candidate.updatedAt).toBeInstanceOf(Date);
    });

    it('should transition candidate status through lifecycle (pending -> accepted/rejected)', async () => {
      const user = await createTestUser('cand-lifecycle');

      // 1. Pending candidate
      const [cand1] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          category: 'semantic_fact',
          content: 'User lives in Tokyo.',
          confidence: '0.95',
          confidenceType: 'explicit',
        })
        .returning();

      expect(cand1.status).toBe('pending');

      // 2. Accept candidate
      const [accepted] = await db
        .update(memoryCandidates)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(memoryCandidates.id, cand1.id))
        .returning();

      expect(accepted.status).toBe('accepted');

      // 3. Reject candidate with reason
      const [cand2] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          category: 'episodic_event',
          content: 'User went for a run.',
          confidence: '0.60',
          confidenceType: 'inferred',
        })
        .returning();

      const [rejected] = await db
        .update(memoryCandidates)
        .set({
          status: 'rejected',
          rejectionReason: 'Low conversational significance, transient daily action.',
          updatedAt: new Date(),
        })
        .where(eq(memoryCandidates.id, cand2.id))
        .returning();

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Low conversational significance, transient daily action.');
    });

    it('should enforce check constraint on invalid candidate category', async () => {
      const user = await createTestUser('cand-chk-cat');
      await expect(
        db.insert(memoryCandidates).values({
          userId: user.id,
          category: 'invalid_category' as any,
          content: 'Invalid category test',
          confidence: '0.80',
          confidenceType: 'explicit',
        }),
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Requirement 3 & 4: Durable Memory Creation, Fields & Confidence Types
  // ============================================================================
  describe('Requirements 3 & 4: Durable Memory Creation, Fields & Confidence State', () => {
    it('should insert durable memory linked to candidate with defaults', async () => {
      const user = await createTestUser('mem-fields');

      const [candidate] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          category: 'semantic_fact',
          content: 'User works as a Distributed Systems Architect.',
          confidence: '0.98',
          confidenceType: 'explicit',
        })
        .returning();

      const [memory] = await db
        .insert(memories)
        .values({
          userId: user.id,
          candidateId: candidate.id,
          category: candidate.category as any,
          content: candidate.content,
          confidence: candidate.confidence,
          confidenceType: candidate.confidenceType as any,
          sourceType: 'conversation',
          importance: 8,
          metadata: { verified: true },
        })
        .returning();

      expect(memory.id).toBeDefined();
      expect(memory.userId).toBe(user.id);
      expect(memory.candidateId).toBe(candidate.id);
      expect(memory.category).toBe('semantic_fact');
      expect(memory.content).toBe('User works as a Distributed Systems Architect.');
      expect(memory.confidence).toBe('0.98');
      expect(memory.confidenceType).toBe('explicit');
      expect(memory.status).toBe('active'); // default
      expect(memory.sourceType).toBe('conversation'); // default
      expect(memory.reinforcementCount).toBe(1); // default
      expect(memory.importance).toBe(8);
      expect(memory.metadata).toEqual({ verified: true });
    });

    it('should support explicit vs inferred confidence types and validate constraints', async () => {
      const user = await createTestUser('mem-confidence');

      // Explicit memory
      const [explicitMem] = await db
        .insert(memories)
        .values({
          userId: user.id,
          category: 'user_preference',
          content: 'User dislikes sweet desserts.',
          confidence: '0.95',
          confidenceType: 'explicit',
        })
        .returning();
      expect(explicitMem.confidenceType).toBe('explicit');

      // Inferred memory
      const [inferredMem] = await db
        .insert(memories)
        .values({
          userId: user.id,
          category: 'user_preference',
          content: 'User tends to work late on Thursday evenings.',
          confidence: '0.68',
          confidenceType: 'inferred',
        })
        .returning();
      expect(inferredMem.confidenceType).toBe('inferred');

      // Invalid confidence type rejected by check constraint
      await expect(
        db.insert(memories).values({
          userId: user.id,
          category: 'user_preference',
          content: 'Invalid confidence type test',
          confidence: '0.80',
          confidenceType: 'unverified' as any,
        }),
      ).rejects.toThrow();

      // Confidence > 1.00 rejected by check constraint
      await expect(
        db.insert(memories).values({
          userId: user.id,
          category: 'user_preference',
          content: 'Invalid confidence value test',
          confidence: '1.50',
          confidenceType: 'explicit',
        }),
      ).rejects.toThrow();

      // Negative confidence rejected by check constraint
      await expect(
        db.insert(memories).values({
          userId: user.id,
          category: 'user_preference',
          content: 'Negative confidence value test',
          confidence: '-0.10',
          confidenceType: 'explicit',
        }),
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Requirement 5: Supersession Self-Referential Model
  // ============================================================================
  describe('Requirement 5: Supersession Self-Referential Relationship', () => {
    it('should link older memory to newer memory via supersededById and status', async () => {
      const user = await createTestUser('mem-supersede');

      // Memory A (Original Fact)
      const [memoryA] = await db
        .insert(memories)
        .values({
          userId: user.id,
          category: 'user_preference',
          content: 'User uses Neovim as primary text editor.',
          confidence: '0.95',
          confidenceType: 'explicit',
          status: 'active',
        })
        .returning();

      // Memory B (Updated Fact)
      const [memoryB] = await db
        .insert(memories)
        .values({
          userId: user.id,
          category: 'user_preference',
          content: 'User switched to Helix as primary text editor.',
          confidence: '0.98',
          confidenceType: 'explicit',
          status: 'active',
        })
        .returning();

      // Supersede Memory A
      const [supersededA] = await db
        .update(memories)
        .set({
          status: 'superseded',
          supersededById: memoryB.id,
          updatedAt: new Date(),
        })
        .where(eq(memories.id, memoryA.id))
        .returning();

      expect(supersededA.status).toBe('superseded');
      expect(supersededA.supersededById).toBe(memoryB.id);

      // Verify querying active memories excludes superseded
      const activeMemories = await db
        .select()
        .from(memories)
        .where(and(eq(memories.userId, user.id), eq(memories.status, 'active')));

      expect(activeMemories.length).toBe(1);
      expect(activeMemories[0].id).toBe(memoryB.id);

      // Verify deleting Memory B sets supersededById to NULL on Memory A (ON DELETE SET NULL)
      await db.delete(memories).where(eq(memories.id, memoryB.id));

      const [reloadedA] = await db.select().from(memories).where(eq(memories.id, memoryA.id));
      expect(reloadedA).toBeDefined();
      expect(reloadedA.supersededById).toBeNull();
      expect(reloadedA.status).toBe('superseded');
    });
  });

  // ============================================================================
  // Requirement 6: User Ownership & Cascade Deletion
  // ============================================================================
  describe('Requirement 6: User Ownership & Cascade Deletion', () => {
    it('should cascade delete all memory jobs, candidates, memories, and embeddings when user is deleted', async () => {
      const user = await createTestUser('cascade');
      const conv = await createTestConversation(user.id);
      const msg = await createTestMessage(conv.id);

      // 1. Extraction Job
      const [job] = await db
        .insert(memoryExtractionJobs)
        .values({
          userId: user.id,
          conversationId: conv.id,
          messageId: msg.id,
          status: 'completed',
        })
        .returning();

      // 2. Candidate
      const [candidate] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          jobId: job.id,
          category: 'semantic_fact',
          content: 'User has a golden retriever named Max.',
          confidence: '0.90',
          confidenceType: 'explicit',
        })
        .returning();

      // 3. Durable Memory
      const [memory] = await db
        .insert(memories)
        .values({
          userId: user.id,
          candidateId: candidate.id,
          category: 'semantic_fact',
          content: 'User has a golden retriever named Max.',
          confidence: '0.90',
          confidenceType: 'explicit',
        })
        .returning();

      // 4. Memory Embedding (768 dimensions)
      const embeddingVec = Array(768).fill(0.025);
      await db.insert(memoryEmbeddings).values({
        userId: user.id,
        memoryId: memory.id,
        embedding: embeddingVec,
        provider: 'gemini',
        model: 'text-embedding-004',
        dimensions: 768,
      });

      // Verify records exist before user deletion
      const preJobs = await db.select().from(memoryExtractionJobs).where(eq(memoryExtractionJobs.userId, user.id));
      const preCands = await db.select().from(memoryCandidates).where(eq(memoryCandidates.userId, user.id));
      const preMems = await db.select().from(memories).where(eq(memories.userId, user.id));
      const preEmbs = await db.select().from(memoryEmbeddings).where(eq(memoryEmbeddings.userId, user.id));

      expect(preJobs.length).toBe(1);
      expect(preCands.length).toBe(1);
      expect(preMems.length).toBe(1);
      expect(preEmbs.length).toBe(1);

      // Delete User
      await db.delete(users).where(eq(users.id, user.id));

      // Verify all tables have 0 rows for this user
      const postJobs = await db.select().from(memoryExtractionJobs).where(eq(memoryExtractionJobs.userId, user.id));
      const postCands = await db.select().from(memoryCandidates).where(eq(memoryCandidates.userId, user.id));
      const postMems = await db.select().from(memories).where(eq(memories.userId, user.id));
      const postEmbs = await db.select().from(memoryEmbeddings).where(eq(memoryEmbeddings.userId, user.id));

      expect(postJobs.length).toBe(0);
      expect(postCands.length).toBe(0);
      expect(postMems.length).toBe(0);
      expect(postEmbs.length).toBe(0);
    });
  });

  // ============================================================================
  // Requirement 7: Cross-User Isolation
  // ============================================================================
  describe('Requirement 7: Cross-User Isolation', () => {
    it('should strictly isolate memories and candidates between distinct users', async () => {
      const userA = await createTestUser('isolation-a');
      const userB = await createTestUser('isolation-b');

      // User A Memory
      await db.insert(memories).values({
        userId: userA.id,
        category: 'semantic_fact',
        content: "User A's private confidential project codename is Helios.",
        confidence: '0.99',
        confidenceType: 'explicit',
      });

      // User B Memory
      await db.insert(memories).values({
        userId: userB.id,
        category: 'semantic_fact',
        content: "User B's private confidential project codename is Selene.",
        confidence: '0.99',
        confidenceType: 'explicit',
      });

      // Query User A
      const memsA = await db.select().from(memories).where(eq(memories.userId, userA.id));
      expect(memsA.length).toBe(1);
      expect(memsA[0].content).toContain('Helios');
      expect(memsA[0].content).not.toContain('Selene');

      // Query User B
      const memsB = await db.select().from(memories).where(eq(memories.userId, userB.id));
      expect(memsB.length).toBe(1);
      expect(memsB[0].content).toContain('Selene');
      expect(memsB[0].content).not.toContain('Helios');
    });
  });

  // ============================================================================
  // Requirement 8: Temporal Fields & Reinforcement
  // ============================================================================
  describe('Requirement 8: Temporal Fields & Reinforcement', () => {
    it('should support validFrom, validUntil, and lastReinforcedAt tracking', async () => {
      const user = await createTestUser('temporal');

      const validFrom = new Date('2026-01-01T00:00:00Z');
      const validUntil = new Date('2026-12-31T23:59:59Z');

      const [memory] = await db
        .insert(memories)
        .values({
          userId: user.id,
          category: 'episodic_event',
          content: 'User holds 2026 residency scholarship in Berlin.',
          confidence: '0.90',
          confidenceType: 'explicit',
          validFrom,
          validUntil,
        })
        .returning();

      expect(new Date(memory.validFrom!).toISOString()).toBe(validFrom.toISOString());
      expect(new Date(memory.validUntil!).toISOString()).toBe(validUntil.toISOString());
      expect(memory.reinforcementCount).toBe(1);

      // Reinforce memory
      const reinforcedAt = new Date();
      const [reinforced] = await db
        .update(memories)
        .set({
          reinforcementCount: memory.reinforcementCount + 1,
          lastReinforcedAt: reinforcedAt,
          updatedAt: reinforcedAt,
        })
        .where(eq(memories.id, memory.id))
        .returning();

      expect(reinforced.reinforcementCount).toBe(2);
      expect(reinforced.lastReinforcedAt.getTime()).toBeGreaterThanOrEqual(memory.lastReinforcedAt.getTime());
    });
  });

  // ============================================================================
  // Requirement 9: Embedding Row Association & Cascade
  // ============================================================================
  describe('Requirement 9: Embedding Row Association (1:1 with Memory & Cascade Delete)', () => {
    it('should associate a 768-dim vector embedding and enforce 1:1 uniqueness', async () => {
      const user = await createTestUser('emb-assoc');

      const [memory] = await db
        .insert(memories)
        .values({
          userId: user.id,
          category: 'user_preference',
          content: 'User prefers concise summaries.',
          confidence: '0.90',
          confidenceType: 'explicit',
        })
        .returning();

      const vec = Array(768).fill(0.0123);

      const [emb] = await db
        .insert(memoryEmbeddings)
        .values({
          userId: user.id,
          memoryId: memory.id,
          embedding: vec,
          provider: 'gemini',
          model: 'text-embedding-004',
          dimensions: 768,
        })
        .returning();

      expect(emb.id).toBeDefined();
      expect(emb.memoryId).toBe(memory.id);
      expect(emb.userId).toBe(user.id);
      expect(emb.dimensions).toBe(768);

      // Attempting to insert duplicate embedding for the same memoryId must violate unique constraint
      await expect(
        db.insert(memoryEmbeddings).values({
          userId: user.id,
          memoryId: memory.id,
          embedding: vec,
          provider: 'gemini',
          model: 'text-embedding-004',
          dimensions: 768,
        }),
      ).rejects.toThrow();

      // Deleting memory must cascade delete embedding row
      await db.delete(memories).where(eq(memories.id, memory.id));

      const embsAfterDelete = await db
        .select()
        .from(memoryEmbeddings)
        .where(eq(memoryEmbeddings.id, emb.id));
      expect(embsAfterDelete.length).toBe(0);
    });
  });

  // ============================================================================
  // Requirement 10: Extraction Job Outbox Lifecycle
  // ============================================================================
  describe('Requirement 10: Extraction Job Outbox Lifecycle', () => {
    it('should transition through pending -> processing -> failed (with retry) -> completed', async () => {
      const user = await createTestUser('job-lifecycle');
      const conv = await createTestConversation(user.id);
      const msg = await createTestMessage(conv.id);

      // 1. Initial pending job
      const [job] = await db
        .insert(memoryExtractionJobs)
        .values({
          userId: user.id,
          conversationId: conv.id,
          messageId: msg.id,
          status: 'pending',
          turnContext: {
            userMessage: msg.content,
            triggerSource: 'post_turn_pipeline',
          },
        })
        .returning();

      expect(job.status).toBe('pending');
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
      expect(job.turnContext).toEqual({
        userMessage: msg.content,
        triggerSource: 'post_turn_pipeline',
      });

      // 2. Mark processing
      const [processingJob] = await db
        .update(memoryExtractionJobs)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(memoryExtractionJobs.id, job.id))
        .returning();

      expect(processingJob.status).toBe('processing');

      // 3. Mark failed with error and retry count increment
      const [failedJob] = await db
        .update(memoryExtractionJobs)
        .set({
          status: 'failed',
          retryCount: job.retryCount + 1,
          lastError: 'Gemini extraction service temporary 503 unavailable',
          updatedAt: new Date(),
        })
        .where(eq(memoryExtractionJobs.id, job.id))
        .returning();

      expect(failedJob.status).toBe('failed');
      expect(failedJob.retryCount).toBe(1);
      expect(failedJob.lastError).toBe('Gemini extraction service temporary 503 unavailable');

      // 4. Retry and complete
      const completedAt = new Date();
      const [completedJob] = await db
        .update(memoryExtractionJobs)
        .set({
          status: 'completed',
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(memoryExtractionJobs.id, job.id))
        .returning();

      expect(completedJob.status).toBe('completed');
      expect(completedJob.completedAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // Requirement 12: Foreign Key Constraints & Nullable References
  // ============================================================================
  describe('Requirement 12: Foreign Key Constraints & Nullable References', () => {
    it('should set candidate sourceMessageId to NULL if message is deleted', async () => {
      const user = await createTestUser('fk-msg-cand');
      const conv = await createTestConversation(user.id);
      const msg = await createTestMessage(conv.id);

      const [cand] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          sourceConversationId: conv.id,
          sourceMessageId: msg.id,
          category: 'semantic_fact',
          content: 'User loves hiking in the Alps.',
          confidence: '0.85',
          confidenceType: 'explicit',
        })
        .returning();

      expect(cand.sourceMessageId).toBe(msg.id);

      // Delete message
      await db.delete(conversationMessages).where(eq(conversationMessages.id, msg.id));

      const [reloadedCand] = await db
        .select()
        .from(memoryCandidates)
        .where(eq(memoryCandidates.id, cand.id));

      expect(reloadedCand).toBeDefined();
      expect(reloadedCand.sourceMessageId).toBeNull();
      expect(reloadedCand.sourceConversationId).toBe(conv.id);
    });

    it('should set memory candidateId to NULL if candidate is deleted', async () => {
      const user = await createTestUser('fk-cand-mem');

      const [cand] = await db
        .insert(memoryCandidates)
        .values({
          userId: user.id,
          category: 'user_preference',
          content: 'User prefers mechanical keyboards.',
          confidence: '0.90',
          confidenceType: 'explicit',
        })
        .returning();

      const [mem] = await db
        .insert(memories)
        .values({
          userId: user.id,
          candidateId: cand.id,
          category: 'user_preference',
          content: cand.content,
          confidence: cand.confidence,
          confidenceType: cand.confidenceType as any,
        })
        .returning();

      expect(mem.candidateId).toBe(cand.id);

      // Delete candidate
      await db.delete(memoryCandidates).where(eq(memoryCandidates.id, cand.id));

      const [reloadedMem] = await db.select().from(memories).where(eq(memories.id, mem.id));
      expect(reloadedMem).toBeDefined();
      expect(reloadedMem.candidateId).toBeNull();
    });

    it('should cascade delete extraction jobs when conversation is deleted', async () => {
      const user = await createTestUser('fk-conv-job');
      const conv = await createTestConversation(user.id);

      const [job] = await db
        .insert(memoryExtractionJobs)
        .values({
          userId: user.id,
          conversationId: conv.id,
          status: 'pending',
        })
        .returning();

      // Delete conversation
      await db.delete(conversations).where(eq(conversations.id, conv.id));

      const jobsAfterDelete = await db
        .select()
        .from(memoryExtractionJobs)
        .where(eq(memoryExtractionJobs.id, job.id));

      expect(jobsAfterDelete.length).toBe(0);
    });
  });
});
