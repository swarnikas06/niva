import { pgTable, uuid, varchar, integer, jsonb, timestamp, vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { memories } from './memories';

export const memoryEmbeddings = pgTable('memory_embeddings', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  memoryId: uuid('memory_id')
    .references(() => memories.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  embedding: vector('embedding', { dimensions: 768 }).notNull(),
  provider: varchar('provider', { length: 64 }).default('gemini').notNull(),
  model: varchar('model', { length: 64 }).default('text-embedding-004').notNull(),
  dimensions: integer('dimensions').default(768).notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type NewMemoryEmbedding = typeof memoryEmbeddings.$inferInsert;
