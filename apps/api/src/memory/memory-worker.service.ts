import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import { MemoryService } from './memory.service';

@Injectable()
export class MemoryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryWorkerService.name);
  private timer?: NodeJS.Timeout;
  private isPolling = false;

  constructor(
    private readonly repository: MemoryRepository,
    @Inject(forwardRef(() => MemoryService))
    private readonly memoryService: MemoryService,
  ) {}

  async onModuleInit() {
    // 1. Recover any jobs stuck in 'processing' state from previous process restart/crash
    try {
      const recovered = await this.repository.recoverStuckJobs(2);
      if (recovered > 0) {
        this.logger.log(`Recovered ${recovered} stuck memory extraction jobs after service restart`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to recover stuck memory extraction jobs: ${err.message}`);
    }

    // 2. Start background polling ticker (every 5 seconds)
    this.timer = setInterval(() => {
      this.pollAndProcessJobs().catch((err) => {
        this.logger.error(`Error in memory extraction worker tick: ${err.message}`, err.stack);
      });
    }, 5000);

    // Initial check
    setImmediate(() => {
      this.pollAndProcessJobs().catch(() => {});
    });

    this.logger.log('MemoryWorkerService initialized with 5-second polling interval');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Immediately triggers processing for a newly enqueued job.
   */
  triggerJob(jobId: string, userId: string) {
    setImmediate(() => {
      this.processSingleJob(jobId, userId).catch((err) => {
        this.logger.warn(`Immediate trigger for memory extraction job ${jobId} failed: ${err.message}`);
      });
    });
  }

  /**
   * Polls the outbox table for pending or retryable failed jobs across all users.
   */
  async pollAndProcessJobs(): Promise<number> {
    if (this.isPolling) {
      return 0;
    }
    this.isPolling = true;

    let processedCount = 0;
    try {
      const pendingJobs = await this.repository.findPendingJobs(5);
      if (pendingJobs.length === 0) {
        return 0;
      }

      this.logger.debug(`Found ${pendingJobs.length} pending memory extraction jobs to process`);

      for (const job of pendingJobs) {
        try {
          await this.processSingleJob(job.id, job.userId);
          processedCount++;
        } catch (err: any) {
          this.logger.warn(`Failed processing extraction job ${job.id} for user ${job.userId}: ${err.message}`);
        }
      }
    } finally {
      this.isPolling = false;
    }

    return processedCount;
  }

  /**
   * Executes the full extraction & durable persistence lifecycle for a single job:
   * 1. Claims job atomically (status: pending -> processing)
   * 2. Calls memoryService.processExtractionJob to extract candidates via AI Gateway
   * 3. For each extracted candidate, calls memoryService.evaluateCandidate:
   *    - Deduplicates against existing memories via pgvector similarity search
   *    - Validates durability rules
   *    - Atomically accepts and persists durable memory + embedding in PostgreSQL
   *    - Or reinforces existing memory if duplicate
   * 4. Updates job status to completed
   */
  async processSingleJob(jobId: string, userId: string): Promise<void> {
    this.logger.log(`[MemoryWorker] Starting extraction lifecycle for job ${jobId} (user: ${userId})`);

    // 1. Process extraction and candidate generation
    let result;
    try {
      result = await this.memoryService.processExtractionJob(jobId, userId);
    } catch (err: any) {
      if (err?.status === 409) {
        // Job was already claimed or processed concurrently by another worker
        this.logger.debug(`[MemoryWorker] Job ${jobId} was already claimed or processed: ${err.message}`);
        return;
      }
      throw err;
    }

    const { candidatesCreated, extractedCount } = result;
    this.logger.log(
      `[MemoryWorker] Job ${jobId} extracted ${extractedCount} candidate(s). Evaluating candidates for durable persistence...`,
    );

    // 2. Automatically evaluate each candidate for durable PostgreSQL persistence
    let acceptedCount = 0;
    let duplicateCount = 0;

    for (const candidate of candidatesCreated) {
      try {
        const evalOutcome = await this.memoryService.evaluateCandidate(candidate.id, userId);
        if (evalOutcome.decision === 'accept' || evalOutcome.decision === 'supersede') {
          acceptedCount++;
          this.logger.log(
            `[MemoryWorker] Candidate ${candidate.id} ACCEPTED as durable memory ${evalOutcome.durableMemory?.id}: "${candidate.content.slice(0, 50)}..."`,
          );
        } else if (evalOutcome.reinforcedMemory) {
          duplicateCount++;
          this.logger.log(
            `[MemoryWorker] Candidate ${candidate.id} identified as duplicate; reinforced existing memory ${evalOutcome.reinforcedMemory?.id}`,
          );
        } else {
          this.logger.log(`[MemoryWorker] Candidate ${candidate.id} decision: ${evalOutcome.decision} (${evalOutcome.reason})`);
        }
      } catch (candErr: any) {
        this.logger.warn(
          `[MemoryWorker] Failed evaluating candidate ${candidate.id} for job ${jobId}: ${candErr.message}`,
        );
      }
    }

    // 3. Finalize job status to completed once all candidates have been evaluated
    await this.repository.updateJob(jobId, userId, {
      status: 'completed',
      completedAt: new Date(),
      lastError: null,
    });

    this.logger.log(
      `[MemoryWorker] Job ${jobId} fully completed. Candidates: ${extractedCount}, Durable memories saved: ${acceptedCount}, Duplicates reinforced: ${duplicateCount}`,
    );
  }
}
