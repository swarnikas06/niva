import { pgTable, uuid, varchar, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { conversations } from './conversations';

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  senderRole: varchar('sender_role', { length: 32 }).notNull(), // user, assistant, system
  content: text('content').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  status: varchar('status', { length: 32 }).default('complete').notNull(), // complete, deleted
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
