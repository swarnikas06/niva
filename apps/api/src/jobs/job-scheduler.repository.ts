import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lte, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { scheduledJobs, ScheduledJob, NewScheduledJob } from '../database/schema/scheduled-jobs';

@Injectable()
export class JobSchedulerRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Persists a new scheduled job with idempotency guarantee.
   * If a job with the same (userId, idempotencyKey) exists, updates it or returns existing.
   */
  async scheduleJob(data: NewScheduledJob): Promise<ScheduledJob> {
    const [job] = await this.db
      .insert(scheduledJobs)
      .values(data)
      .onConflictDoUpdate({
        target: [scheduledJobs.userId, scheduledJobs.idempotencyKey],
        set: {
          scheduledAt: data.scheduledAt,
          status: 'pending',
          payload: data.payload,
          retryCount: 0,
          lastError: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return job!;
  }

  /**
   * Concurrency-safe poll for due jobs using PostgreSQL FOR UPDATE SKIP LOCKED.
   * Atomically claims jobs by setting status to 'processing'.
   */
  async claimDueJobs(limit = 10): Promise<ScheduledJob[]> {
    return this.db.transaction(async (tx) => {
      const dueJobs = await tx
        .select()
        .from(scheduledJobs)
        .where(
          and(
            inArray(scheduledJobs.status, ['pending', 'rescheduled']),
            lte(scheduledJobs.scheduledAt, new Date()),
          ),
        )
        .orderBy(scheduledJobs.scheduledAt)
        .limit(limit)
        .for('update', { skipLocked: true });

      if (dueJobs.length === 0) {
        return [];
      }

      const ids = dueJobs.map((j) => j.id);
      await tx
        .update(scheduledJobs)
        .set({
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(inArray(scheduledJobs.id, ids));

      return dueJobs;
    });
  }

  async updateJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob | null> {
    const [updated] = await this.db
      .update(scheduledJobs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(scheduledJobs.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Cancels all pending jobs for a specific target entity (e.g. task or commitment completed).
   */
  async cancelJobsForTarget(targetType: string, targetId: string): Promise<number> {
    const res = await this.db
      .update(scheduledJobs)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledJobs.targetType, targetType),
          eq(scheduledJobs.targetId, targetId),
          inArray(scheduledJobs.status, ['pending', 'processing', 'rescheduled']),
        ),
      )
      .returning();

    return res.length;
  }

  /**
   * Reschedules jobs for a target entity to new timestamps (e.g. deadline postponed).
   */
  async rescheduleJob(id: string, newScheduledAt: Date): Promise<ScheduledJob | null> {
    const [updated] = await this.db
      .update(scheduledJobs)
      .set({
        scheduledAt: newScheduledAt,
        status: 'rescheduled',
        updatedAt: new Date(),
      })
      .where(eq(scheduledJobs.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Recovers jobs that were stuck in 'processing' when the server stopped/restarted.
   */
  async recoverStuckJobs(stuckThresholdMinutes = 2): Promise<number> {
    const cutoff = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000);
    const res = await this.db
      .update(scheduledJobs)
      .set({
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledJobs.status, 'processing'),
          lte(scheduledJobs.updatedAt, cutoff),
        ),
      )
      .returning();

    return res.length;
  }

  async findJobsForUser(userId: string, limit = 50): Promise<ScheduledJob[]> {
    return this.db
      .select()
      .from(scheduledJobs)
      .where(eq(scheduledJobs.userId, userId))
      .orderBy(sql`${scheduledJobs.scheduledAt} DESC`)
      .limit(limit);
  }
}
