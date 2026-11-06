import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { characterArchetypes } from './character-archetypes';
import { lifeGoals } from './life-goals';
import { lifeProjects } from './life-projects';

export const companionStates = pgTable('companion_states', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  characterId: varchar('character_id', { length: 50 })
    .references(() => characterArchetypes.id, { onDelete: 'restrict' })
    .notNull(),
  presenceStatus: varchar('presence_status', { length: 20 }).default('active').notNull(),
  interactionMode: varchar('interaction_mode', { length: 30 }).default('chat').notNull(),
  activeFocusGoalId: uuid('active_focus_goal_id').references(() => lifeGoals.id, { onDelete: 'set null' }),
  activeFocusProjectId: uuid('active_focus_project_id').references(() => lifeProjects.id, { onDelete: 'set null' }),
  continuityStreakDays: integer('continuity_streak_days').default(1).notNull(),
  totalInteractions: integer('total_interactions').default(0).notNull(),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CompanionState = typeof companionStates.$inferSelect;
export type NewCompanionState = typeof companionStates.$inferInsert;
