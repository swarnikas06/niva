import { pgTable, uuid, varchar, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { conversations } from './conversations';
import { conversationMessages } from './conversation-messages';

export const memoryExtractionJobs = pgTable('memory_extraction_jobs', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  messageId: uuid('message_id')
    .references(() => conversationMessages.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, processing, completed, failed
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  lastError: text('last_error'),
  turnContext: jsonb('turn_context').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export type MemoryExtractionJob = typeof memoryExtractionJobs.$inferSelect;
export type NewMemoryExtractionJob = typeof memoryExtractionJobs.$inferInsert;
