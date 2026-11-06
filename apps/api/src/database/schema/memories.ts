import { pgTable, uuid, varchar, text, numeric, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { memoryCandidates } from './memory-candidates';
import { conversations } from './conversations';
import { conversationMessages } from './conversation-messages';

export const memories = pgTable('memories', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  candidateId: uuid('candidate_id').references(() => memoryCandidates.id, { onDelete: 'set null' }),
  category: varchar('category', { length: 32 }).notNull(), // semantic_fact, user_preference, episodic_event, open_loop
  content: text('content').notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  confidenceType: varchar('confidence_type', { length: 20 }).notNull(), // explicit, inferred
  status: varchar('status', { length: 32 }).default('active').notNull(), // active, superseded, archived, deleted
  sourceType: varchar('source_type', { length: 32 }).default('conversation').notNull(), // conversation, manual_user, onboarding
  sourceConversationId: uuid('source_conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  sourceMessageId: uuid('source_message_id').references(() => conversationMessages.id, { onDelete: 'set null' }),
  supersededById: uuid('superseded_by_id').references((): any => memories.id, { onDelete: 'set null' }),
  reinforcementCount: integer('reinforcement_count').default(1).notNull(),
  lastReinforcedAt: timestamp('last_reinforced_at', { withTimezone: true }).defaultNow().notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  importance: integer('importance').default(5).notNull(), // 1-10
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
