import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { JobSchedulerRepository } from './job-scheduler.repository';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { EventRepository } from '../events/event.repository';
import { ScheduledJob } from '../database/schema/scheduled-jobs';

export interface ScheduleReminderOptions {
  userId: string;
  targetType: string; // 'commitment' | 'task' | 'goal'
  targetId: string;
  scheduledAt: Date;
  title: string;
  message: string;
  stage: 'advance' | 'progress_check' | 'final' | 'custom';
  channel?: 'in_app' | 'browser' | 'email';
  metadata?: Record<string, any>;
}

@Injectable()
export class JobSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private redis?: Redis;
  private isProcessing = false;
  private tickCount = 0;

  constructor(
    private readonly repository: JobSchedulerRepository,
    @Inject(forwardRef(() => NotificationDeliveryService))
    private readonly deliveryService: NotificationDeliveryService,
    private readonly lifeContextRepository: LifeContextRepository,
    private readonly eventRepository: EventRepository,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
    } catch (e: any) {
      this.logger.warn(`Redis client initialization skipped: ${e.message}`);
    }
  }

  async onModuleInit() {
    // 1. Recover any jobs stuck in 'processing' from a previous crash/restart
    try {
      const recovered = await this.repository.recoverStuckJobs(2);
      if (recovered > 0) {
        this.logger.log(`Recovered ${recovered} stuck scheduled jobs after service restart`);
      }
    } catch (e: any) {
      this.logger.warn(`Job recovery check warning: ${e.message}`);
    }

    // 2. Start background polling ticker (every 5 seconds)
    this.timer = setInterval(() => {
      this.pollAndExecuteJobs().catch((err) => {
        this.logger.error(`Error in scheduled job tick: ${err.message}`, err.stack);
      });
    }, 5000);

    this.logger.log('JobSchedulerService initialized with 5-second polling interval');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.redis) {
      this.redis.disconnect();
    }
    this.logger.log('JobSchedulerService stopped');
  }

  /**
   * Schedules a single reminder job with deterministic idempotencyKey.
   */
  async scheduleReminder(opts: ScheduleReminderOptions): Promise<ScheduledJob> {
    const { userId, targetType, targetId, scheduledAt, title, message, stage, channel = 'in_app', metadata = {} } = opts;
    const idempotencyKey = `rem:${targetType}:${targetId}:${stage}`;

    const job = await this.repository.scheduleJob({
      userId,
      jobType: 'REMINDER',
      targetType,
      targetId,
      scheduledAt,
      status: 'pending',
      idempotencyKey,
      payload: {
        title,
        message,
        stage,
        channel,
        targetType,
        targetId,
        metadata,
      },
      retryCount: 0,
      maxRetries: 3,
    });

    this.logger.log(
      `[Job Scheduled] ID: ${job.id} for user ${userId} (${stage}) at ${scheduledAt.toISOString()} - "${title}"`,
    );

    return job;
  }

  /**
   * Automatically schedules 3-tier advance reminder intelligence for a deadline:
   * 1. Advance Notice: 2 days before (48h)
   * 2. Progress Check: 24h before
   * 3. Final Reminder: 2h before
   */
  async scheduleDeadlineIntelligence(
    userId: string,
    targetType: string,
    targetId: string,
    title: string,
    dueAt: Date,
    _userTimezone = 'UTC',
  ): Promise<ScheduledJob[]> {
    const jobs: ScheduledJob[] = [];
    const now = Date.now();
    const dueTime = dueAt.getTime();

    // Fetch user preferences for advance notice timings
    const prefs = await this.eventRepository.getUserPreferences(userId);
    const tz = _userTimezone !== 'UTC' ? _userTimezone : (prefs?.timezone || 'UTC');
    const advanceDays = prefs?.advanceReminderDays ?? 2;
    const progressCheckHours = prefs?.progressCheckHours ?? 24;
    const finalHours = prefs?.finalReminderHours ?? 2;

    const diffMs = dueTime - now;
    if (diffMs <= 0) {
      this.logger.warn(`Deadline for ${targetType} "${title}" is in the past; skipping reminder scheduling.`);
      return jobs;
    }

    const minFutureBufferMs = 30_000; // at least 30 seconds into the future

    // 1. Advance Reminder (e.g. 48h before)
    const advanceMs = advanceDays * 24 * 60 * 60 * 1000;
    const advanceTime = new Date(dueTime - advanceMs);
    if (advanceTime.getTime() > now + minFutureBufferMs) {
      const job = await this.scheduleReminder({
        userId,
        targetType,
        targetId,
        scheduledAt: advanceTime,
        title: `Upcoming Deadline: ${title}`,
        message: `Your ${targetType} "${title}" is due in ${advanceDays} days on ${dueAt.toLocaleDateString('en-US', { timeZone: tz })}. Make sure you're on track!`,
        stage: 'advance',
      });
      jobs.push(job);
    }

    // 2. Progress Check (e.g. 24h before)
    const progressMs = progressCheckHours * 60 * 60 * 1000;
    const progressTime = new Date(dueTime - progressMs);
    if (progressTime.getTime() > now + minFutureBufferMs) {
      const job = await this.scheduleReminder({
        userId,
        targetType,
        targetId,
        scheduledAt: progressTime,
        title: `Progress Check: ${title}`,
        message: `Quick check-in on "${title}": it's due tomorrow! How is your progress coming along?`,
        stage: 'progress_check',
      });
      jobs.push(job);
    } else if (diffMs >= 6 * 60 * 60 * 1000 && jobs.length === 0) {
      // If deadline is between 6h and 24h, schedule an interim check at halfway point
      const interimTime = new Date(now + Math.floor(diffMs * 0.5));
      if (interimTime.getTime() > now + minFutureBufferMs) {
        const job = await this.scheduleReminder({
          userId,
          targetType,
          targetId,
          scheduledAt: interimTime,
          title: `Interim Check: ${title}`,
          message: `Halfway check-in on "${title}": due in ${Math.round(diffMs / (60 * 60 * 1000))} hours!`,
          stage: 'progress_check',
        });
        jobs.push(job);
      }
    }

    // 3. Final Warning (e.g. 2h before)
    const finalMs = finalHours * 60 * 60 * 1000;
    const finalTime = new Date(dueTime - finalMs);
    if (finalTime.getTime() > now + minFutureBufferMs) {
      const job = await this.scheduleReminder({
        userId,
        targetType,
        targetId,
        scheduledAt: finalTime,
        title: `Final Reminder: ${title}`,
        message: `Final reminder: "${title}" is due in ${finalHours} hours (at ${dueAt.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' })})!`,
        stage: 'final',
      });
      jobs.push(job);
    }

    // 4. Very Close Deadline (e.g. under 2 hours)
    if (jobs.length === 0) {
      // Schedule at halfway point (e.g. 20 minutes for a 40-minute deadline), minimum 30s in future
      const halfwayMs = Math.max(Math.floor(diffMs * 0.5), minFutureBufferMs);
      const tightTime = new Date(now + halfwayMs);
      if (tightTime.getTime() < dueTime) {
        const job = await this.scheduleReminder({
          userId,
          targetType,
          targetId,
          scheduledAt: tightTime,
          title: `Deadline Approaching: ${title}`,
          message: `"${title}" is due very soon (at ${dueAt.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' })})!`,
          stage: 'final',
        });
        jobs.push(job);
      }
    }

    return jobs;
  }

  /**
   * Cancels all scheduled jobs for a target entity (e.g. when completed or deleted).
   */
  async cancelJobsForTarget(targetType: string, targetId: string): Promise<number> {
    const count = await this.repository.cancelJobsForTarget(targetType, targetId);
    this.logger.log(`Cancelled ${count} scheduled jobs for ${targetType} ${targetId}`);
    return count;
  }

  /**
   * Reschedules jobs when a deadline changes.
   */
  async rescheduleDeadline(
    userId: string,
    targetType: string,
    targetId: string,
    title: string,
    newDueAt: Date,
    timezone?: string,
  ): Promise<ScheduledJob[]> {
    // Cancel prior jobs and recreate for new date
    await this.cancelJobsForTarget(targetType, targetId);
    return this.scheduleDeadlineIntelligence(userId, targetType, targetId, title, newDueAt, timezone);
  }

  /**
   * Polling loop: Claims due jobs via PostgreSQL FOR UPDATE SKIP LOCKED and delivers them.
   */
  async pollAndExecuteJobs(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    let executedCount = 0;
    try {
      this.tickCount++;
      if (this.tickCount % 4 === 0) {
        await this.repository.recoverStuckJobs(2).catch(() => {});
      }

      const jobs = await this.repository.claimDueJobs(10);
      if (jobs.length === 0) {
        return 0;
      }

      this.logger.log(`Processing batch of ${jobs.length} due scheduled jobs`);

      for (const job of jobs) {
        try {
          await this.executeJob(job);
          executedCount++;
        } catch (err: any) {
          this.logger.error(`Job ${job.id} execution failed: ${err.message}`, err.stack);
          const nextRetry = (job.retryCount || 0) + 1;
          if (nextRetry < (job.maxRetries || 3)) {
            // Exponential backoff retry in 1 minute
            await this.repository.updateJob(job.id, {
              retryCount: nextRetry,
              lastError: err.message,
              scheduledAt: new Date(Date.now() + 60000),
              status: 'pending',
            });
          } else {
            await this.repository.updateJob(job.id, {
              status: 'failed',
              lastError: err.message,
            });
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return executedCount;
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    const payload = (job.payload as Record<string, any>) || {};

    // 1. Completion-based cancellation check
    // If target task/commitment is already completed or cancelled, do NOT deliver notification!
    if (job.targetType === 'commitment') {
      const commitment = await this.lifeContextRepository.findCommitmentById(job.targetId, job.userId);
      if (!commitment || commitment.status === 'fulfilled' || commitment.status === 'cancelled') {
        this.logger.log(`Job ${job.id} cancelled: commitment ${job.targetId} is already ${commitment?.status || 'missing'}`);
        await this.repository.updateJob(job.id, {
          status: 'cancelled',
          executedAt: new Date(),
        });
        return;
      }
    } else if (job.targetType === 'task') {
      const task = await this.lifeContextRepository.findTaskById(job.targetId, job.userId);
      if (!task || task.status === 'completed' || task.status === 'cancelled') {
        this.logger.log(`Job ${job.id} cancelled: task ${job.targetId} is already ${task?.status || 'missing'}`);
        await this.repository.updateJob(job.id, {
          status: 'cancelled',
          executedAt: new Date(),
        });
        return;
      }
    }

    // 2. Deliver notification via NotificationDeliveryService
    const title = payload.title || 'NIVA Reminder';
    const message = payload.message || 'You have an upcoming commitment.';
    const channel = payload.channel || 'in_app';
    const actionUrl =
      job.targetType === 'commitment'
        ? `/conversation?commitmentId=${job.targetId}`
        : job.targetType === 'task'
          ? `/conversation?taskId=${job.targetId}`
          : '/conversation';

    await this.deliveryService.deliver({
      userId: job.userId,
      jobId: job.id,
      channel,
      title,
      body: message,
      actionUrl,
      metadata: {
        jobId: job.id,
        targetType: job.targetType,
        targetId: job.targetId,
        stage: payload.stage,
      },
    });

    // 3. Mark job completed
    await this.repository.updateJob(job.id, {
      status: 'completed',
      executedAt: new Date(),
    });

    this.logger.log(`[Job Completed] ID: ${job.id} for user ${job.userId}: "${title}"`);
  }
}
