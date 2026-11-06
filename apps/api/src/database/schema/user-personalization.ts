import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { characterArchetypes } from './character-archetypes';

export const userPersonalization = pgTable('user_personalization', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  preferredName: varchar('preferred_name', { length: 100 }),
  occupationRole: varchar('occupation_role', { length: 100 }),
  primaryFocus: varchar('primary_focus', { length: 50 }),
  selectedArchetypeId: varchar('selected_archetype_id', { length: 50 })
    .references(() => characterArchetypes.id)
    .default('niva_anchor')
    .notNull(),
  warmth: integer('warmth').default(75).notNull(),
  directness: integer('directness').default(65).notNull(),
  humor: integer('humor').default(50).notNull(),
  challengeLevel: integer('challenge_level').default(60).notNull(),
  proactivity: varchar('proactivity', { length: 20 }).default('medium').notNull(),
  responseLength: varchar('response_length', { length: 20 }).default('balanced').notNull(),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  onboardingStep: varchar('onboarding_step', { length: 50 }).default('identity').notNull(),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserPersonalization = typeof userPersonalization.$inferSelect;
export type NewUserPersonalization = typeof userPersonalization.$inferInsert;
