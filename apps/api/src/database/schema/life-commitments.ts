import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { lifeGoals } from './life-goals';
import { lifeProjects } from './life-projects';

export const lifeCommitments = pgTable('life_commitments', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  commitmentType: varchar('commitment_type', { length: 64 }).notNull(), // interview, exam, deadline, meeting, habit_routine
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 32 }).default('upcoming').notNull(), // upcoming, fulfilled, missed, rescheduled
  importance: varchar('importance', { length: 32 }).default('standard').notNull(), // critical, high, standard
  relatedGoalId: uuid('related_goal_id')
    .references(() => lifeGoals.id, { onDelete: 'set null' }),
  relatedProjectId: uuid('related_project_id')
    .references(() => lifeProjects.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LifeCommitment = typeof lifeCommitments.$inferSelect;
export type NewLifeCommitment = typeof lifeCommitments.$inferInsert;
