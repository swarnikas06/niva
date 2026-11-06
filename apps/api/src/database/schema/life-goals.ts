import { pgTable, uuid, varchar, text, date, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const lifeGoals = pgTable('life_goals', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 64 }).notNull(), // career, technical, academic, personal, health
  targetDate: date('target_date'),
  status: varchar('status', { length: 32 }).default('active').notNull(), // active, completed, paused, abandoned
  priority: varchar('priority', { length: 32 }).default('medium').notNull(), // high, medium, low
  progressPercentage: integer('progress_percentage').default(0).notNull(), // 0-100
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LifeGoal = typeof lifeGoals.$inferSelect;
export type NewLifeGoal = typeof lifeGoals.$inferInsert;
