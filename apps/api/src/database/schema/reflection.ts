import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  real,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const longitudinalObservations = pgTable(
  'longitudinal_observations',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    fact: text('fact').notNull(),
    interpretation: text('interpretation').notNull(),
    supportingEvidence: jsonb('supporting_evidence').default(sql`'[]'::jsonb`).notNull(),
    timeWindowStart: timestamp('time_window_start', { withTimezone: true }).notNull(),
    timeWindowEnd: timestamp('time_window_end', { withTimezone: true }).notNull(),
    windowDays: integer('window_days').default(7).notNull(),
    confidence: real('confidence').default(0.8).notNull(),
    confidenceType: varchar('confidence_type', { length: 32 }).default('inferred_pattern').notNull(),
    status: varchar('status', { length: 32 }).default('active').notNull(),
    userCorrectionNotes: text('user_correction_notes'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    correctedAt: timestamp('corrected_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    surfacedCount: integer('surfaced_count').default(0).notNull(),
    lastSurfacedAt: timestamp('last_surfaced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index('idx_longitudinal_obs_user_status').on(table.userId, table.status),
    userCategoryIdx: index('idx_longitudinal_obs_user_category').on(table.userId, table.category),
    userCreatedIdx: index('idx_longitudinal_obs_user_created').on(table.userId, table.createdAt),
  }),
);

export const reflectionSnapshots = pgTable(
  'reflection_snapshots',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    windowDays: integer('window_days').default(14).notNull(),
    summary: text('summary').notNull(),
    progressItems: jsonb('progress_items').default(sql`'[]'::jsonb`).notNull(),
    unresolvedItems: jsonb('unresolved_items').default(sql`'[]'::jsonb`).notNull(),
    intentionsAndOutcomes: jsonb('intentions_and_outcomes').default(sql`'[]'::jsonb`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_reflection_snapshots_user_created').on(table.userId, table.createdAt),
  }),
);

export type LongitudinalObservation = typeof longitudinalObservations.$inferSelect;
export type NewLongitudinalObservation = typeof longitudinalObservations.$inferInsert;

export type ReflectionSnapshot = typeof reflectionSnapshots.$inferSelect;
export type NewReflectionSnapshot = typeof reflectionSnapshots.$inferInsert;
