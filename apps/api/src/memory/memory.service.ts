import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  BadGatewayException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { MemoryWorkerService } from './memory-worker.service';
import { MemoryRepository } from './memory.repository';
import { AiGatewayService } from '../ai/ai-gateway.service';
import {
  MemoryExtractionJobDto,
  MemoryCandidateDto,
  MemoryDto,
  MemoryEmbeddingDto,
  ProcessExtractionJobResultDto,
  EvaluateCandidateResultDto,
  RelatedMemoryContext,
} from '@niva/shared-types';
import {
  ExtractedMemoryCandidateItemSchema,
} from '@niva/validation';
import {
  CreateExtractionJobDto,
  ListMemoryJobsQueryDto,
  ListMemoryCandidatesQueryDto,
  ListMemoriesQueryDto,
} from './dto/memory.dto';
import {
  MemoryExtractionJob,
  MemoryCandidate,
  Memory,
  NewMemory,
  MemoryEmbedding,
  NewMemoryCandidate,
} from '../database/schema';
import { EventPublisherService } from '../events/event-publisher.service';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly repository: MemoryRepository,
    private readonly aiGatewayService: AiGatewayService,
    private readonly eventPublisher: EventPublisherService,
    @Optional()
    @Inject(forwardRef(() => MemoryWorkerService))
    private readonly workerService?: MemoryWorkerService,
  ) {}

  // ============================================================================
  // EXTRACTION JOBS
  // ============================================================================

  async createExtractionJob(
    userId: string,
    dto: CreateExtractionJobDto,
  ): Promise<MemoryExtractionJobDto> {
    // 1. Verify conversation ownership
    const conv = await this.repository.findConversationById(dto.conversationId, userId);
    if (!conv) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    // 2. Insert job into PostgreSQL outbox table
    const job = await this.repository.createJob({
      userId,
      conversationId: dto.conversationId,
      messageId: dto.messageId || null,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      turnContext: dto.turnContext || {},
    });

    this.logger.log(
      `Created memory extraction job ${job.id} for user ${userId} on conversation ${dto.conversationId}`,
    );

    // 3. Immediately trigger background processing via MemoryWorkerService
    if (this.workerService) {
      this.workerService.triggerJob(job.id, userId);
    }

    return this.mapJobToDto(job);
  }

  async getExtractionJobs(
    userId: string,
    query?: ListMemoryJobsQueryDto,
  ): Promise<MemoryExtractionJobDto[]> {
    const jobs = await this.repository.findJobsByUser(userId, {
      status: query?.status,
      limit: query?.limit,
    });
    return jobs.map((j) => this.mapJobToDto(j));
  }

  async getExtractionJobById(
    jobId: string,
    userId: string,
  ): Promise<MemoryExtractionJobDto> {
    const job = await this.repository.findJobById(jobId, userId);
    if (!job) {
      throw new NotFoundException(`Extraction job ${jobId} not found`);
    }
    return this.mapJobToDto(job);
  }

  /**
   * Processes a memory extraction job idempotently and recoverably.
   * Atomically transitions status pending -> processing -> completed/failed.
   */
  async processExtractionJob(
    jobId: string,
    userId: string,
  ): Promise<ProcessExtractionJobResultDto> {
    // 1. Look up existing job
    const existingJob = await this.repository.findJobById(jobId, userId);
    if (!existingJob) {
      throw new NotFoundException(`Extraction job ${jobId} not found`);
    }

    // 2. Idempotency: If already completed, return existing state
    if (existingJob.status === 'completed') {
      const existingCandidates = await this.repository.findCandidatesByUser(userId);
      const jobCandidates = existingCandidates.filter((c) => c.jobId === jobId);
      return {
        job: this.mapJobToDto(existingJob),
        candidatesCreated: jobCandidates.map((c) => this.mapCandidateToDto(c)),
        extractedCount: jobCandidates.length,
      };
    }

    // 3. Prevent duplicate concurrent processing
    if (existingJob.status === 'processing') {
      throw new ConflictException(`Job ${jobId} is currently being processed`);
    }

    // 4. Check retry limits
    if (existingJob.retryCount >= existingJob.maxRetries) {
      throw new BadRequestException(
        `Job ${jobId} has exceeded maximum retry attempts (${existingJob.maxRetries})`,
      );
    }

    // 5. Atomic Claim: Transition status to 'processing'
    const claimedJob = await this.repository.claimJob(jobId, userId);
    if (!claimedJob) {
      throw new ConflictException(
        `Job ${jobId} could not be claimed for processing (may have been claimed by another worker)`,
      );
    }

    try {
      // 6. Assemble turn context for extraction
      const messages = await this.repository.findRecentConversationMessages(
        claimedJob.conversationId,
        6,
      );

      // Determine the user message to extract from
      let userMessage = '';
      if (claimedJob.turnContext && typeof claimedJob.turnContext === 'object') {
        userMessage = String((claimedJob.turnContext as any).userMessage || '');
      }

      if (!userMessage && claimedJob.messageId) {
        const targetMsg = messages.find((m) => m.id === claimedJob.messageId);
        if (targetMsg && targetMsg.senderRole === 'user') {
          userMessage = targetMsg.content;
        }
      }

      if (!userMessage) {
        // Fallback to the latest user message in history
        const latestUserMsg = [...messages].reverse().find((m) => m.senderRole === 'user');
        if (latestUserMsg) {
          userMessage = latestUserMsg.content;
        }
      }

      if (!userMessage.trim()) {
        // Nothing to extract
        const completedJob = await this.repository.updateJob(jobId, userId, {
          status: 'completed',
          completedAt: new Date(),
        });
        return {
          job: this.mapJobToDto(completedJob),
          candidatesCreated: [],
          extractedCount: 0,
        };
      }

      // Fetch character persona if available
      const persona = await this.repository.findUserCharacterPersona(userId);

      // 7. Dispatch extraction request to FastAPI AI Service
      const extractionResult = await this.aiGatewayService.extractMemoryCandidates({
        conversationId: claimedJob.conversationId,
        messageId: claimedJob.messageId,
        userMessage,
        recentHistory: messages.map((m) => ({
          senderRole: m.senderRole as 'user' | 'assistant',
          content: m.content,
        })),
        characterPersona: persona,
        requestId: `job-${jobId}`,
      });

      // 8. Validate and sanitize extracted candidates
      const candidatesToInsert: Array<NewMemoryCandidate> = [];

      for (const rawCand of extractionResult.candidates) {
        const parseResult = ExtractedMemoryCandidateItemSchema.safeParse(rawCand);
        if (!parseResult.success) {
          this.logger.warn(
            `[job-${jobId}] Discarding malformed candidate from AI output: ${parseResult.error.message}`,
          );
          continue;
        }

        const validItem = parseResult.data;

        // INVARIANT: Phase 3B must NEVER automatically accept extracted candidates as durable memories.
        // All newly extracted candidates default strictly to status: 'pending'.
        candidatesToInsert.push({
          userId,
          jobId: claimedJob.id,
          sourceConversationId: claimedJob.conversationId,
          sourceMessageId: claimedJob.messageId,
          category: validItem.category,
          content: validItem.content,
          confidence: validItem.confidence.toFixed(2),
          confidenceType: validItem.confidenceType,
          status: 'pending',
          importance: validItem.importance,
          rationale: validItem.rationale || null,
          metadata: validItem.metadata || {},
        });
      }

      // 9. Persist validated candidates in database
      const persistedCandidates = await this.repository.createCandidates(candidatesToInsert);

      // 10. If no candidates, mark completed immediately; otherwise keep processing until worker evaluates candidates
      const statusToSet = persistedCandidates.length === 0 ? 'completed' : 'processing';
      const updatedJob = await this.repository.updateJob(jobId, userId, {
        status: statusToSet,
        completedAt: statusToSet === 'completed' ? new Date() : null,
        lastError: null,
      });

      this.logger.log(
        `Job ${jobId} successfully processed: ${persistedCandidates.length} memory candidates persisted (status=${statusToSet})`,
      );

      return {
        job: this.mapJobToDto(updatedJob),
        candidatesCreated: persistedCandidates.map((c) => this.mapCandidateToDto(c)),
        extractedCount: persistedCandidates.length,
      };
    } catch (err: any) {
      // 11. Handle failure and update job status
      const nextRetryCount = claimedJob.retryCount + 1;
      const isExhausted = nextRetryCount >= claimedJob.maxRetries;
      const errorMsg = err?.message || 'Unknown extraction failure';

      this.logger.error(
        `Job ${jobId} failed on attempt ${nextRetryCount}/${claimedJob.maxRetries} (exhausted=${isExhausted}): ${errorMsg}`,
      );

      await this.repository.updateJob(jobId, userId, {
        status: 'failed',
        retryCount: nextRetryCount,
        lastError: errorMsg,
      });

      throw err;
    }
  }

  // ============================================================================
  // MEMORY CANDIDATES
  // ============================================================================

  async getCandidates(
    userId: string,
    query?: ListMemoryCandidatesQueryDto,
  ): Promise<MemoryCandidateDto[]> {
    const candidates = await this.repository.findCandidatesByUser(userId, {
      status: query?.status,
      category: query?.category,
      limit: query?.limit,
    });
    return candidates.map((c) => this.mapCandidateToDto(c));
  }

  async getCandidateById(candidateId: string, userId: string): Promise<MemoryCandidateDto> {
    const candidate = await this.repository.findCandidateById(candidateId, userId);
    if (!candidate) {
      throw new NotFoundException(`Memory candidate ${candidateId} not found`);
    }
    return this.mapCandidateToDto(candidate);
  }

  /**
   * Phase 3C: Evaluates a candidate memory against durability criteria,
   * operational boundaries, and existing active memories via vector similarity search.
   * Produces an atomic outcome: accept, reject, supersede, or defer.
   */
  async evaluateCandidate(
    candidateId: string,
    userId: string,
  ): Promise<EvaluateCandidateResultDto> {
    // 1. Fetch and verify candidate ownership and status
    const candidate = await this.repository.findCandidateById(candidateId, userId);
    if (!candidate) {
      throw new NotFoundException(`Memory candidate ${candidateId} not found`);
    }

    if (candidate.status === 'accepted') {
      throw new ConflictException(`Candidate ${candidateId} has already been accepted as a durable memory`);
    }

    // 2. Generate temporary embedding for candidate to query existing semantic memories
    let candidateEmbedding: number[] = [];
    let embeddingLatencyMs = 0;
    let embedProvider = 'mock';
    let embedModel = 'mock-embedding';
    try {
      const embedResult = await this.aiGatewayService.generateEmbedding({
        text: candidate.content,
        requestId: `eval-cand-${candidateId}`,
      });
      candidateEmbedding = embedResult.embedding;
      embeddingLatencyMs = embedResult.latencyMs;
      embedProvider = embedResult.provider;
      embedModel = embedResult.model;
    } catch (err: any) {
      this.logger.warn(
        `Failed to generate embedding for candidate evaluation (${candidateId}): ${err.message}. Proceeding without similarity context.`,
      );
    }

    // 3. Find top similar active memories for user (if embedding succeeded)
    let relatedMemories: RelatedMemoryContext[] = [];
    if (candidateEmbedding.length === 768) {
      const similar = await this.repository.findSimilarMemories(
        userId,
        candidateEmbedding,
        5,
        0.60,
      );
      relatedMemories = similar.map((m) => ({
        id: m.id,
        content: m.content,
        category: m.category as any,
        similarity: m.similarity,
      }));
    }

    // 4. Request candidate evaluation from AI Gateway
    const evalResponse = await this.aiGatewayService.evaluateMemoryCandidate({
      candidateId: candidate.id,
      category: candidate.category as any,
      content: candidate.content,
      confidence: parseFloat(candidate.confidence),
      confidenceType: candidate.confidenceType as any,
      existingMemories: relatedMemories,
      context: {
        ...(candidate.metadata as Record<string, unknown>),
        sourceConversationId: candidate.sourceConversationId,
        sourceMessageId: candidate.sourceMessageId,
      },
      requestId: `eval-${candidate.id}`,
    });

    let durableMemory: Memory | null = null;
    let supersededMemory: Memory | null = null;
    let reinforcedMemory: Memory | null = null;
    let embeddingCreated = false;
    let updatedCandidate: MemoryCandidate = candidate;

    // 5. Execute decision atomically
    if (evalResponse.decision === 'accept' || evalResponse.decision === 'supersede') {
      const supersedesId =
        evalResponse.decision === 'supersede' ? evalResponse.supersedesMemoryId : null;

      // If superseding, ensure the old memory exists and belongs to the user
      if (supersedesId) {
        supersededMemory = await this.repository.findMemoryById(supersedesId, userId);
        if (!supersededMemory) {
          this.logger.warn(
            `Supersedes memory ID ${supersedesId} not found for user ${userId}; continuing acceptance without supersession link`,
          );
        }
      }

      const newMemoryData: NewMemory = {
        userId,
        candidateId: candidate.id,
        category: candidate.category,
        content: candidate.content,
        confidence: candidate.confidence,
        confidenceType: candidate.confidenceType,
        status: 'active',
        sourceType: 'conversation',
        sourceConversationId: candidate.sourceConversationId,
        sourceMessageId: candidate.sourceMessageId,
        importance: candidate.importance,
        metadata: {
          evaluatedAt: new Date().toISOString(),
          evaluationReason: evalResponse.reason,
          aiProvider: evalResponse.provider,
          aiModel: evalResponse.model,
          evaluationLatencyMs: evalResponse.latencyMs,
          supersededMemoryId: supersededMemory ? supersededMemory.id : null,
        },
      };

      const result = await this.repository.executeMemoryAcceptanceTransaction({
        candidateId: candidate.id,
        userId,
        memoryData: newMemoryData,
        supersedesMemoryId: supersededMemory ? supersededMemory.id : null,
      });

      durableMemory = result.memory;
      updatedCandidate = result.candidate;

      // If we had superseded a memory, refresh its record
      if (supersededMemory) {
        supersededMemory = await this.repository.findMemoryById(supersededMemory.id, userId);
      }

      // 6. Persist embedding for the new durable memory
      if (candidateEmbedding.length === 768) {
        await this.repository.upsertMemoryEmbedding({
          memoryId: durableMemory.id,
          userId,
          embedding: candidateEmbedding,
          provider: embedProvider,
          model: embedModel,
          dimensions: 768,
          metadata: {
            embeddedAt: new Date().toISOString(),
            latencyMs: embeddingLatencyMs,
          },
        });
        embeddingCreated = true;
      }

      // Publish MemoryAccepted domain event
      await this.eventPublisher.publish({
        userId,
        eventType: 'MemoryAccepted',
        aggregateType: 'memory',
        aggregateId: durableMemory.id,
        payload: {
          memoryId: durableMemory.id,
          category: durableMemory.category,
          content: durableMemory.content,
          importance: durableMemory.importance,
        },
      });

      // If a previous memory was superseded, publish MemorySuperseded event
      if (supersededMemory) {
        await this.eventPublisher.publish({
          userId,
          eventType: 'MemorySuperseded',
          aggregateType: 'memory',
          aggregateId: supersededMemory.id,
          payload: {
            supersededMemoryId: supersededMemory.id,
            newMemoryId: durableMemory.id,
            category: supersededMemory.category,
            content: supersededMemory.content,
          },
        });
      }
    } else if (evalResponse.decision === 'reject') {
      // If rejected as a duplicate, reinforce the existing memory
      if (evalResponse.duplicateOfMemoryId) {
        reinforcedMemory = await this.repository.reinforceMemory(
          evalResponse.duplicateOfMemoryId,
          userId,
        );
      }

      updatedCandidate = await this.repository.updateCandidate(candidate.id, userId, {
        status: 'rejected',
        rejectionReason: evalResponse.reason,
      });
    } else if (evalResponse.decision === 'defer') {
      updatedCandidate = await this.repository.updateCandidate(candidate.id, userId, {
        status: 'deferred',
        rejectionReason: evalResponse.reason,
      });
    }

    return {
      candidate: this.mapCandidateToDto(updatedCandidate),
      decision: evalResponse.decision,
      reason: evalResponse.reason,
      durableMemory: durableMemory ? this.mapMemoryToDto(durableMemory) : null,
      supersededMemory: supersededMemory ? this.mapMemoryToDto(supersededMemory) : null,
      reinforcedMemory: reinforcedMemory ? this.mapMemoryToDto(reinforcedMemory) : null,
      embeddingCreated,
    };
  }


  // ============================================================================
  // EMBEDDING GENERATION & PERSISTENCE
  // ============================================================================

  /**
   * Generates and persists a dense 768-dim vector embedding for a durable memory.
   * Invoked explicitly for accepted/durable memories.
   */
  async generateAndPersistEmbedding(
    userId: string,
    memoryId: string,
    explicitText?: string,
  ): Promise<MemoryEmbeddingDto> {
    // 1. Verify memory exists and belongs to user
    const memory = await this.repository.findMemoryById(memoryId, userId);
    if (!memory) {
      throw new NotFoundException(`Durable memory ${memoryId} not found`);
    }

    const textToEmbed = (explicitText || memory.content).trim();
    if (!textToEmbed) {
      throw new BadRequestException('Text to embed cannot be empty');
    }

    // 2. Dispatch embedding generation to FastAPI AI Gateway
    const embedResult = await this.aiGatewayService.generateEmbedding({
      text: textToEmbed,
      memoryId,
      requestId: `emb-${memoryId}`,
    });

    // 3. Strict dimension verification: MUST be 768 dimensions for PostgreSQL vector(768)
    if (embedResult.dimensions !== 768 || embedResult.embedding.length !== 768) {
      this.logger.error(
        `Embedding dimension mismatch: expected 768, received ${embedResult.dimensions}`,
      );
      throw new BadGatewayException(
        `Embedding dimension mismatch: expected 768, received ${embedResult.dimensions}`,
      );
    }

    // 4. Persist to PostgreSQL memory_embeddings table
    const embeddingRow = await this.repository.upsertMemoryEmbedding({
      memoryId,
      userId,
      embedding: embedResult.embedding,
      provider: embedResult.provider,
      model: embedResult.model,
      dimensions: embedResult.dimensions,
      metadata: {
        embeddedAt: new Date().toISOString(),
        latencyMs: embedResult.latencyMs,
      },
    });

    this.logger.log(
      `Successfully persisted 768-dim embedding for memory ${memoryId} via ${embedResult.provider} (${embedResult.model})`,
    );

    return this.mapEmbeddingToDto(embeddingRow);
  }

  async getMemoryEmbedding(
    userId: string,
    memoryId: string,
  ): Promise<MemoryEmbeddingDto> {
    const memory = await this.repository.findMemoryById(memoryId, userId);
    if (!memory) {
      throw new NotFoundException(`Durable memory ${memoryId} not found`);
    }

    const embedding = await this.repository.findEmbeddingByMemoryId(memoryId, userId);
    if (!embedding) {
      throw new NotFoundException(`Embedding for memory ${memoryId} not found`);
    }

    return this.mapEmbeddingToDto(embedding);
  }

  // ============================================================================
  // DURABLE MEMORIES RETRIEVAL
  // ============================================================================

  async getMemories(
    userId: string,
    query?: ListMemoriesQueryDto,
  ): Promise<{ items: MemoryDto[]; total: number }> {
    const [memories, total] = await Promise.all([
      this.repository.findMemories(userId, {
        status: query?.status,
        category: query?.category,
        search: query?.search,
        limit: query?.limit,
        offset: query?.offset,
      }),
      this.repository.countMemories(userId, {
        status: query?.status,
        category: query?.category,
        search: query?.search,
      }),
    ]);

    return {
      items: memories.map((m) => this.mapMemoryToDto(m)),
      total,
    };
  }

  async getMemoryById(memoryId: string, userId: string, includeArchived = false): Promise<MemoryDto> {
    const memory = await this.repository.findMemoryById(memoryId, userId);
    if (!memory || (!includeArchived && memory.status === 'archived')) {
      throw new NotFoundException(`Durable memory ${memoryId} not found`);
    }

    let sourceConversationTitle: string | null = null;
    if (memory.sourceConversationId) {
      try {
        const conv = await this.repository.findConversationById(memory.sourceConversationId, userId);
        if (conv) {
          sourceConversationTitle = conv.title;
        }
      } catch (err) {
        this.logger.warn(`Failed to resolve conversation title for ${memory.sourceConversationId}: ${err}`);
      }
    }

    return this.mapMemoryToDto(memory, sourceConversationTitle);
  }

  async forgetMemory(memoryId: string, userId: string): Promise<MemoryDto> {
    const memory = await this.repository.findMemoryById(memoryId, userId);
    if (!memory) {
      throw new NotFoundException(`Durable memory ${memoryId} not found`);
    }

    const archived = await this.repository.archiveMemory(memoryId, userId);
    if (!archived) {
      throw new NotFoundException(`Failed to archive memory ${memoryId}`);
    }

    this.logger.log(`User ${userId} forgot/archived memory ${memoryId}`);
    return this.mapMemoryToDto(archived);
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapMemoryToDto(mem: Memory, sourceConversationTitle?: string | null): MemoryDto {
    return {
      id: mem.id,
      userId: mem.userId,
      candidateId: mem.candidateId,
      category: mem.category as any,
      content: mem.content,
      confidence: parseFloat(mem.confidence),
      confidenceType: mem.confidenceType as any,
      status: mem.status as any,
      sourceType: mem.sourceType as any,
      sourceConversationId: mem.sourceConversationId,
      sourceConversationTitle: sourceConversationTitle !== undefined ? sourceConversationTitle : undefined,
      sourceMessageId: mem.sourceMessageId,
      supersededById: mem.supersededById,
      reinforcementCount: mem.reinforcementCount,
      lastReinforcedAt: mem.lastReinforcedAt.toISOString(),
      validFrom: mem.validFrom ? mem.validFrom.toISOString() : null,
      validUntil: mem.validUntil ? mem.validUntil.toISOString() : null,
      importance: mem.importance,
      metadata: (mem.metadata as Record<string, unknown>) || {},
      createdAt: mem.createdAt.toISOString(),
      updatedAt: mem.updatedAt.toISOString(),
    };
  }

  private mapJobToDto(job: MemoryExtractionJob): MemoryExtractionJobDto {
    return {
      id: job.id,
      userId: job.userId,
      conversationId: job.conversationId,
      messageId: job.messageId,
      status: job.status as any,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      lastError: job.lastError,
      turnContext: (job.turnContext as Record<string, unknown>) || {},
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    };
  }

  private mapCandidateToDto(cand: MemoryCandidate): MemoryCandidateDto {
    return {
      id: cand.id,
      userId: cand.userId,
      jobId: cand.jobId,
      sourceConversationId: cand.sourceConversationId,
      sourceMessageId: cand.sourceMessageId,
      category: cand.category as any,
      content: cand.content,
      confidence: parseFloat(cand.confidence),
      confidenceType: cand.confidenceType as any,
      status: cand.status as any,
      rejectionReason: cand.rejectionReason,
      importance: cand.importance,
      rationale: cand.rationale,
      metadata: (cand.metadata as Record<string, unknown>) || {},
      createdAt: cand.createdAt.toISOString(),
      updatedAt: cand.updatedAt.toISOString(),
    };
  }

  private mapEmbeddingToDto(emb: MemoryEmbedding): MemoryEmbeddingDto {
    return {
      id: emb.id,
      memoryId: emb.memoryId,
      userId: emb.userId,
      provider: emb.provider,
      model: emb.model,
      dimensions: emb.dimensions,
      metadata: (emb.metadata as Record<string, unknown>) || {},
      createdAt: emb.createdAt.toISOString(),
    };
  }
}
