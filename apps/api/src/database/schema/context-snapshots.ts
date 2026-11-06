import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { conversations } from './conversations';

export const contextSnapshots = pgTable('context_snapshots', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  triggerReason: varchar('trigger_reason', { length: 50 }).notNull(),
  tokenBudgetAllocated: integer('token_budget_allocated').notNull(),
  tokenCountEstimated: integer('token_count_estimated').notNull(),
  assembledFrame: jsonb('assembled_frame').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ContextSnapshot = typeof contextSnapshots.$inferSelect;
export type NewContextSnapshot = typeof contextSnapshots.$inferInsert;
