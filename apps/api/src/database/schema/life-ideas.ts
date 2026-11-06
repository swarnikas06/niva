import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { lifeProjects } from './life-projects';

export const lifeIdeas = pgTable('life_ideas', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').default(sql`'[]'::jsonb`),
  status: varchar('status', { length: 32 }).default('raw').notNull(), // raw, incubating, promoted, archived
  promotedToProjectId: uuid('promoted_to_project_id')
    .references(() => lifeProjects.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LifeIdea = typeof lifeIdeas.$inferSelect;
export type NewLifeIdea = typeof lifeIdeas.$inferInsert;
