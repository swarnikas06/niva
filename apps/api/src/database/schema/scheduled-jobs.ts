import { pgTable, uuid, varchar, integer, text, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobType: varchar('job_type', { length: 64 }).notNull(), // REMINDER, PROGRESS_CHECK, FINAL_WARNING, PROACTIVE_CHECKIN, STUDY_RETENTION_CHECK
    targetType: varchar('target_type', { length: 64 }).notNull(), // commitment, task, goal, project, conversation
    targetId: varchar('target_id', { length: 128 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, processing, completed, cancelled, failed, rescheduled
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    payload: jsonb('payload').default(sql`'{}'::jsonb`).notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    lastError: text('last_error'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdempotencyIdx: uniqueIndex('scheduled_jobs_user_idempotency_idx').on(
      table.userId,
      table.idempotencyKey,
    ),
    pollIdx: index('scheduled_jobs_poll_idx').on(table.status, table.scheduledAt),
    targetIdx: index('scheduled_jobs_target_idx').on(table.targetType, table.targetId),
  }),
);

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type NewScheduledJob = typeof scheduledJobs.$inferInsert;
