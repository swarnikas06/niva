import { pgTable, uuid, varchar, text, date, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { lifeGoals } from './life-goals';

export const lifeProjects = pgTable('life_projects', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  goalId: uuid('goal_id')
    .references(() => lifeGoals.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 }).default('in_progress').notNull(), // planning, in_progress, on_hold, completed, archived
  color: varchar('color', { length: 32 }),
  startDate: date('start_date'),
  targetDate: date('target_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LifeProject = typeof lifeProjects.$inferSelect;
export type NewLifeProject = typeof lifeProjects.$inferInsert;
