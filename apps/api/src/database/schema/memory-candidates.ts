import { pgTable, uuid, varchar, text, numeric, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { memoryExtractionJobs } from './memory-extraction-jobs';
import { conversations } from './conversations';
import { conversationMessages } from './conversation-messages';

export const memoryCandidates = pgTable('memory_candidates', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  jobId: uuid('job_id').references(() => memoryExtractionJobs.id, { onDelete: 'set null' }),
  sourceConversationId: uuid('source_conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  sourceMessageId: uuid('source_message_id').references(() => conversationMessages.id, { onDelete: 'set null' }),
  category: varchar('category', { length: 32 }).notNull(), // semantic_fact, user_preference, episodic_event, open_loop
  content: text('content').notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  confidenceType: varchar('confidence_type', { length: 20 }).notNull(), // explicit, inferred
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, accepted, rejected, failed
  rejectionReason: varchar('rejection_reason', { length: 255 }),
  importance: integer('importance').default(5).notNull(), // 1-10
  rationale: text('rationale'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MemoryCandidate = typeof memoryCandidates.$inferSelect;
export type NewMemoryCandidate = typeof memoryCandidates.$inferInsert;
