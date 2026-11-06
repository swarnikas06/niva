import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  numeric,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { lifeGoals } from './life-goals';
import { careerSkills } from './career';

export const studyTopics = pgTable('study_topics', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  parentTopicId: uuid('parent_topic_id').references(
    (): any => studyTopics.id,
    { onDelete: 'set null' },
  ),
  subjectName: varchar('subject_name', { length: 150 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('not_started').notNull(),
  targetProficiency: varchar('target_proficiency', { length: 50 })
    .default('intermediate')
    .notNull(),
  demonstratedProficiency: varchar('demonstrated_proficiency', { length: 50 }),
  linkedGoalId: uuid('linked_goal_id').references(() => lifeGoals.id, {
    onDelete: 'set null',
  }),
  linkedSkillId: uuid('linked_skill_id').references(() => careerSkills.id, {
    onDelete: 'set null',
  }),
  learningObjectives: jsonb('learning_objectives')
    .default(sql`'[]'::jsonb`)
    .notNull(),
  prerequisiteTopicIds: jsonb('prerequisite_topic_ids')
    .default(sql`'[]'::jsonb`)
    .notNull(),
  confidenceScore: integer('confidence_score').default(0).notNull(),
  lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  topicId: uuid('topic_id')
    .references(() => studyTopics.id, { onDelete: 'cascade' })
    .notNull(),
  sessionType: varchar('session_type', { length: 50 })
    .default('concept_study')
    .notNull(),
  status: varchar('status', { length: 50 }).default('in_progress').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  userNotes: text('user_notes'),
  conceptsUnderstood: jsonb('concepts_understood')
    .default(sql`'[]'::jsonb`)
    .notNull(),
  difficultiesEncountered: jsonb('difficulties_encountered')
    .default(sql`'[]'::jsonb`)
    .notNull(),
  followUpActions: jsonb('follow_up_actions')
    .default(sql`'[]'::jsonb`)
    .notNull(),
  evidenceNotes: text('evidence_notes'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const learningDifficulties = pgTable('learning_difficulties', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  topicId: uuid('topic_id')
    .references(() => studyTopics.id, { onDelete: 'cascade' })
    .notNull(),
  sessionId: uuid('session_id').references(() => studySessions.id, {
    onDelete: 'set null',
  }),
  concept: varchar('concept', { length: 255 }).notNull(),
  description: text('description').notNull(),
  source: varchar('source', { length: 50 }).default('user_reported').notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 })
    .default('1.00')
    .notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type StudyTopic = typeof studyTopics.$inferSelect;
export type NewStudyTopic = typeof studyTopics.$inferInsert;

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

export type LearningDifficulty = typeof learningDifficulties.$inferSelect;
export type NewLearningDifficulty = typeof learningDifficulties.$inferInsert;
