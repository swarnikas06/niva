import { z } from 'zod';

export const TopicProgressStatusEnum = z.enum([
  'not_started',
  'in_progress',
  'practiced',
  'demonstrated',
  'needs_review',
]);

export const StudyProficiencyLevelEnum = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export const StudySessionTypeEnum = z.enum([
  'concept_study',
  'active_recall',
  'problem_solving',
  'revision',
  'exercise',
]);

export const StudySessionStatusEnum = z.enum([
  'in_progress',
  'completed',
  'abandoned',
]);

export const DifficultySourceEnum = z.enum([
  'user_reported',
  'ai_inferred',
  'practice_evaluation',
]);

export const DifficultyStatusEnum = z.enum([
  'active',
  'reviewing',
  'resolved',
]);

// ==========================================
// STUDY TOPIC SCHEMAS
// ==========================================

export const CreateStudyTopicSchema = z.object({
  parentTopicId: z.string().uuid().nullable().optional(),
  subjectName: z.string().min(1, 'Subject name is required').max(150),
  title: z.string().min(1, 'Topic title is required').max(255),
  description: z.string().max(3000).nullable().optional(),
  targetProficiency: StudyProficiencyLevelEnum.optional().default('intermediate'),
  linkedGoalId: z.string().uuid().nullable().optional(),
  linkedSkillId: z.string().uuid().nullable().optional(),
  learningObjectives: z.array(z.string().min(1).max(300)).optional().default([]),
  prerequisiteTopicIds: z.array(z.string().uuid()).optional().default([]),
});

export const UpdateStudyTopicSchema = z.object({
  parentTopicId: z.string().uuid().nullable().optional(),
  subjectName: z.string().min(1).max(150).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(3000).nullable().optional(),
  status: TopicProgressStatusEnum.optional(),
  targetProficiency: StudyProficiencyLevelEnum.optional(),
  demonstratedProficiency: StudyProficiencyLevelEnum.nullable().optional(),
  linkedGoalId: z.string().uuid().nullable().optional(),
  linkedSkillId: z.string().uuid().nullable().optional(),
  learningObjectives: z.array(z.string().min(1).max(300)).optional(),
  prerequisiteTopicIds: z.array(z.string().uuid()).optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
});

// ==========================================
// STUDY SESSION SCHEMAS
// ==========================================

export const StartStudySessionSchema = z.object({
  topicId: z.string().uuid('Valid topic UUID required'),
  sessionType: StudySessionTypeEnum.optional().default('concept_study'),
  userNotes: z.string().max(3000).nullable().optional(),
});

export const CompleteStudySessionSchema = z.object({
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  userNotes: z.string().max(3000).nullable().optional(),
  conceptsUnderstood: z.array(z.string().min(1).max(300)).optional().default([]),
  difficultiesEncountered: z.array(z.string().min(1).max(300)).optional().default([]),
  followUpActions: z.array(z.string().min(1).max(300)).optional().default([]),
  evidenceNotes: z.string().max(3000).nullable().optional(),
  updateTopicStatus: TopicProgressStatusEnum.optional(),
  demonstratedProficiency: StudyProficiencyLevelEnum.optional(),
});

// ==========================================
// LEARNING DIFFICULTIES SCHEMAS
// ==========================================

export const CreateLearningDifficultySchema = z.object({
  topicId: z.string().uuid('Valid topic UUID required'),
  sessionId: z.string().uuid().nullable().optional(),
  concept: z.string().min(1, 'Concept title is required').max(255),
  description: z.string().min(1, 'Description is required').max(3000),
  source: DifficultySourceEnum.optional().default('user_reported'),
  confidence: z.number().min(0).max(1).optional().default(1.0),
});

export const UpdateLearningDifficultySchema = z.object({
  status: DifficultyStatusEnum.optional(),
  resolutionNotes: z.string().max(3000).nullable().optional(),
});
