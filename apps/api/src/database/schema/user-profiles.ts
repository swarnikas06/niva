import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  education: jsonb('education').default(sql`'{}'::jsonb`).notNull(),
  profession: jsonb('profession').default(sql`'{}'::jsonb`).notNull(),
  expertiseAreas: jsonb('expertise_areas').default(sql`'[]'::jsonb`).notNull(),
  interests: jsonb('interests').default(sql`'[]'::jsonb`).notNull(),
  dailyRoutines: jsonb('daily_routines').default(sql`'{}'::jsonb`).notNull(),
  communicationPreferences: jsonb('communication_preferences').default(sql`'{}'::jsonb`).notNull(),
  learningPreferences: jsonb('learning_preferences').default(sql`'{}'::jsonb`).notNull(),
  ongoingChallenges: jsonb('ongoing_challenges').default(sql`'[]'::jsonb`).notNull(),
  importantDates: jsonb('important_dates').default(sql`'[]'::jsonb`).notNull(),
  attributeConfidence: jsonb('attribute_confidence').default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
