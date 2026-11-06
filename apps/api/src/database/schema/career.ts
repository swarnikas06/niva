import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const careerProfiles = pgTable('career_profiles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  headline: varchar('headline', { length: 255 }).notNull(),
  currentLevel: varchar('current_level', { length: 64 }).default('mid_level').notNull(),
  targetTimelineMonths: integer('target_timeline_months').default(6).notNull(),
  targetCompanyTiers: jsonb('target_company_tiers').default(sql`'[]'::jsonb`).notNull(),
  targetLocations: jsonb('target_locations').default(sql`'[]'::jsonb`).notNull(),
  targetCompensationRange: jsonb('target_compensation_range'),
  statedReadiness: varchar('stated_readiness', { length: 64 }).default('early_preparation').notNull(),
  status: varchar('status', { length: 64 }).default('active_preparation').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const careerTargetRoles = pgTable('career_target_roles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  roleFamily: varchar('role_family', { length: 64 }).default('software_engineering').notNull(),
  seniorityLevel: varchar('seniority_level', { length: 64 }).default('senior').notNull(),
  priority: varchar('priority', { length: 32 }).default('primary').notNull(),
  targetCompanyTypes: jsonb('target_company_types').default(sql`'[]'::jsonb`).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const careerSkills = pgTable('career_skills', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  name: varchar('name', { length: 150 }).notNull().unique(),
  category: varchar('category', { length: 64 }).default('core_technical').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const targetRoleSkills = pgTable('target_role_skills', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  targetRoleId: uuid('target_role_id')
    .references(() => careerTargetRoles.id, { onDelete: 'cascade' })
    .notNull(),
  skillId: uuid('skill_id')
    .references(() => careerSkills.id, { onDelete: 'cascade' })
    .notNull(),
  importance: varchar('importance', { length: 32 }).default('high_priority').notNull(),
  minimumProficiency: varchar('minimum_proficiency', { length: 32 }).default('intermediate').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userSkills = pgTable('user_skills', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  skillId: uuid('skill_id')
    .references(() => careerSkills.id, { onDelete: 'cascade' })
    .notNull(),
  selfRating: varchar('self_rating', { length: 32 }).default('intermediate').notNull(),
  verifiedLevel: varchar('verified_level', { length: 32 }),
  confidenceScore: integer('confidence_score').default(50).notNull(),
  lastPracticedAt: timestamp('last_practiced_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const skillEvidence = pgTable('skill_evidence', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userSkillId: uuid('user_skill_id')
    .references(() => userSkills.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  evidenceType: varchar('evidence_type', { length: 64 }).default('project_artifact').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  url: varchar('url', { length: 1000 }),
  validationStatus: varchar('validation_status', { length: 32 }).default('unverified').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const careerPreparationActivities = pgTable('career_preparation_activities', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetRoleId: uuid('target_role_id')
    .references(() => careerTargetRoles.id, { onDelete: 'set null' }),
  skillId: uuid('skill_id')
    .references(() => careerSkills.id, { onDelete: 'set null' }),
  activityType: varchar('activity_type', { length: 64 }).default('coding_challenge').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 32 }).default('planned').notNull(),
  durationMinutes: integer('duration_minutes'),
  outcomeNotes: text('outcome_notes'),
  performanceScore: integer('performance_score'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const careerGapAnalyses = pgTable('career_gap_analyses', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetRoleId: uuid('target_role_id')
    .references(() => careerTargetRoles.id, { onDelete: 'cascade' })
    .notNull(),
  readinessScore: integer('readiness_score').default(0).notNull(),
  statedReadiness: varchar('stated_readiness', { length: 64 }).default('early_preparation').notNull(),
  evidenceAlignmentScore: integer('evidence_alignment_score').default(0).notNull(),
  readinessDiscrepancy: varchar('readiness_discrepancy', { length: 32 }).default('unassessed').notNull(),
  gaps: jsonb('gaps').default(sql`'[]'::jsonb`).notNull(),
  strengths: jsonb('strengths').default(sql`'[]'::jsonb`).notNull(),
  priorities: jsonb('priorities').default(sql`'[]'::jsonb`).notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

export const careerEvaluationSessions = pgTable('career_evaluation_sessions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetRoleId: uuid('target_role_id')
    .references(() => careerTargetRoles.id, { onDelete: 'cascade' })
    .notNull(),
  skillId: uuid('skill_id')
    .references(() => careerSkills.id, { onDelete: 'set null' }),
  evaluationType: varchar('evaluation_type', { length: 64 }).default('technical').notNull(),
  status: varchar('status', { length: 32 }).default('started').notNull(),
  currentDifficulty: varchar('current_difficulty', { length: 32 }).default('intermediate').notNull(),
  currentQuestionIndex: integer('current_question_index').default(0).notNull(),
  totalPlannedQuestions: integer('total_planned_questions').default(3).notNull(),
  overallRating: varchar('overall_rating', { length: 32 }),
  overallScore: integer('overall_score'),
  summary: text('summary'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const careerEvaluationQuestions = pgTable('career_evaluation_questions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  sessionId: uuid('session_id')
    .references(() => careerEvaluationSessions.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  questionText: text('question_text').notNull(),
  difficulty: varchar('difficulty', { length: 32 }).default('intermediate').notNull(),
  targetedSkill: varchar('targeted_skill', { length: 150 }).notNull(),
  contextRationale: text('context_rationale'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const careerEvaluationAnswers = pgTable('career_evaluation_answers', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  questionId: uuid('question_id')
    .references(() => careerEvaluationQuestions.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  sessionId: uuid('session_id')
    .references(() => careerEvaluationSessions.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  answerText: text('answer_text').notNull(),
  evaluationStatus: varchar('evaluation_status', { length: 32 }).default('pending').notNull(),
  overallRating: varchar('overall_rating', { length: 32 }),
  dimensions: jsonb('dimensions').default(sql`'[]'::jsonb`).notNull(),
  strengths: jsonb('strengths').default(sql`'[]'::jsonb`).notNull(),
  gaps: jsonb('gaps').default(sql`'[]'::jsonb`).notNull(),
  followUpNeeded: boolean('follow_up_needed').default(false).notNull(),
  suggestedNextDifficulty: varchar('suggested_next_difficulty', { length: 32 }),
  feedbackNotes: text('feedback_notes'),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CareerProfile = typeof careerProfiles.$inferSelect;
export type NewCareerProfile = typeof careerProfiles.$inferInsert;

export type CareerTargetRole = typeof careerTargetRoles.$inferSelect;
export type NewCareerTargetRole = typeof careerTargetRoles.$inferInsert;

export type CareerSkill = typeof careerSkills.$inferSelect;
export type NewCareerSkill = typeof careerSkills.$inferInsert;

export type TargetRoleSkill = typeof targetRoleSkills.$inferSelect;
export type NewTargetRoleSkill = typeof targetRoleSkills.$inferInsert;

export type UserSkill = typeof userSkills.$inferSelect;
export type NewUserSkill = typeof userSkills.$inferInsert;

export type SkillEvidence = typeof skillEvidence.$inferSelect;
export type NewSkillEvidence = typeof skillEvidence.$inferInsert;

export type CareerPreparationActivity = typeof careerPreparationActivities.$inferSelect;
export type NewCareerPreparationActivity = typeof careerPreparationActivities.$inferInsert;

export type CareerGapAnalysis = typeof careerGapAnalyses.$inferSelect;
export type NewCareerGapAnalysis = typeof careerGapAnalyses.$inferInsert;

export type CareerEvaluationSession = typeof careerEvaluationSessions.$inferSelect;
export type NewCareerEvaluationSession = typeof careerEvaluationSessions.$inferInsert;

export type CareerEvaluationQuestion = typeof careerEvaluationQuestions.$inferSelect;
export type NewCareerEvaluationQuestion = typeof careerEvaluationQuestions.$inferInsert;

export type CareerEvaluationAnswer = typeof careerEvaluationAnswers.$inferSelect;
export type NewCareerEvaluationAnswer = typeof careerEvaluationAnswers.$inferInsert;

