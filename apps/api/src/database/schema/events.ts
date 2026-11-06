import { pgTable, uuid, varchar, integer, boolean, text, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const domainEvents = pgTable('domain_events', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  eventVersion: integer('event_version').default(1).notNull(),
  aggregateType: varchar('aggregate_type', { length: 64 }).notNull(),
  aggregateId: varchar('aggregate_id', { length: 128 }).notNull(),
  payload: jsonb('payload').default(sql`'{}'::jsonb`).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, processing, processed, failed, dead_letter
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  lastError: text('last_error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proactiveCandidates = pgTable('proactive_candidates', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  eventId: uuid('event_id')
    .references(() => domainEvents.id, { onDelete: 'cascade' })
    .notNull(),
  candidateType: varchar('candidate_type', { length: 64 }).notNull(),
  topic: varchar('topic', { length: 128 }).notNull(),
  urgency: varchar('urgency', { length: 32 }).default('medium').notNull(), // low, medium, high
  importance: integer('importance').default(5).notNull(),
  contextSnapshot: jsonb('context_snapshot').default(sql`'{}'::jsonb`).notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, evaluated, discarded
  decision: varchar('decision', { length: 32 }), // NO_ACTION, DEFER, ACT
  decisionReason: text('decision_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
});

export const proactiveActions = pgTable('proactive_actions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  candidateId: uuid('candidate_id')
    .references(() => proactiveCandidates.id, { onDelete: 'set null' }),
  actionType: varchar('action_type', { length: 64 }).default('IN_APP_MESSAGE').notNull(),
  channel: varchar('channel', { length: 32 }).default('in_app').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 32 }).default('delivered').notNull(), // pending_delivery, delivered, dismissed, acted_upon
  deliveredAt: timestamp('delivered_at', { withTimezone: true }).defaultNow(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proactiveCooldowns = pgTable(
  'proactive_cooldowns',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    topic: varchar('topic', { length: 128 }).notNull(),
    candidateType: varchar('candidate_type', { length: 64 }).notNull(),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }).notNull(),
    lastActionId: uuid('last_action_id')
      .references(() => proactiveActions.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTopicCandidateIdx: uniqueIndex('cooldown_user_topic_candidate_idx').on(
      table.userId,
      table.topic,
      table.candidateType,
    ),
  }),
);

export const userProactivePreferences = pgTable('user_proactive_preferences', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  proactiveEnabled: boolean('proactive_enabled').default(true).notNull(),
  quietHoursEnabled: boolean('quiet_hours_enabled').default(true).notNull(),
  quietHoursStart: varchar('quiet_hours_start', { length: 8 }).default('22:00').notNull(),
  quietHoursEnd: varchar('quiet_hours_end', { length: 8 }).default('08:00').notNull(),
  timezone: varchar('timezone', { length: 64 }).default('UTC').notNull(),
  maxDailyInteractions: integer('max_daily_interactions').default(3).notNull(),
  allowHighUrgencyInQuietHours: boolean('allow_high_urgency_in_quiet_hours').default(false).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  browserEnabled: boolean('browser_enabled').default(true).notNull(),
  emailEnabled: boolean('email_enabled').default(false).notNull(),
  advanceReminderDays: integer('advance_reminder_days').default(2).notNull(),
  progressCheckHours: integer('progress_check_hours').default(24).notNull(),
  finalReminderHours: integer('final_reminder_hours').default(2).notNull(),
  morningCheckinEnabled: boolean('morning_checkin_enabled').default(true).notNull(),
  morningCheckinTime: varchar('morning_checkin_time', { length: 8 }).default('09:00').notNull(),
  eveningCheckinEnabled: boolean('evening_checkin_enabled').default(true).notNull(),
  eveningCheckinTime: varchar('evening_checkin_time', { length: 8 }).default('18:00').notNull(),
  weeklyReflectionEnabled: boolean('weekly_reflection_enabled').default(true).notNull(),
  enabledCategories: jsonb('enabled_categories').default(sql`'["deadline_reminders","study_checkins","project_followups","goal_progress","daily_companion","milestone_acknowledgements","gentle_inactivity"]'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DomainEvent = typeof domainEvents.$inferSelect;
export type NewDomainEvent = typeof domainEvents.$inferInsert;

export type ProactiveCandidate = typeof proactiveCandidates.$inferSelect;
export type NewProactiveCandidate = typeof proactiveCandidates.$inferInsert;

export type ProactiveAction = typeof proactiveActions.$inferSelect;
export type NewProactiveAction = typeof proactiveActions.$inferInsert;

export type ProactiveCooldown = typeof proactiveCooldowns.$inferSelect;
export type NewProactiveCooldown = typeof proactiveCooldowns.$inferInsert;

export type UserProactivePreferences = typeof userProactivePreferences.$inferSelect;
export type NewUserProactivePreferences = typeof userProactivePreferences.$inferInsert;
