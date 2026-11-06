import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { characterArchetypes } from './character-archetypes';

export const conversations = pgTable('conversations', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  characterId: varchar('character_id', { length: 50 })
    .references(() => characterArchetypes.id, { onDelete: 'restrict' })
    .notNull(),
  title: varchar('title', { length: 255 }),
  status: varchar('status', { length: 32 }).default('active').notNull(), // active, archived
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
