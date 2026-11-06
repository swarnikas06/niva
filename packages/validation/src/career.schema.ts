import { z } from 'zod';

export const CareerLevelSchema = z.enum([
  'student',
  'entry_level',
  'mid_level',
  'senior',
  'staff_plus',
  'career_switcher',
]);

export const CareerStatusSchema = z.enum([
  'exploring',
  'active_preparation',
  'interviewing',
  'offer_stage',
  'accepted',
  'paused',
]);

export const StatedReadinessSchema = z.enum([
  'exploring',
  'early_preparation',
  'moderate_confidence',
  'interview_ready',
]);

export const RoleFamilySchema = z.enum([
  'software_engineering',
  'systems_infrastructure',
  'data_ai_ml',
  'security',
  'engineering_management',
  'product_management',
  'other',
]);

export const SeniorityLevelSchema = z.enum([
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
]);

export const TargetRolePrioritySchema = z.enum(['primary', 'secondary', 'exploratory']);

export const SkillCategorySchema = z.enum([
  'core_technical',
  'systems_architecture',
  'problem_solving',
  'data_infrastructure',
  'leadership_collaboration',
  'communication',
]);

export const SkillImportanceSchema = z.enum(['mandatory', 'high_priority', 'nice_to_have']);

export const SkillProficiencySchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);

export const EvidenceTypeSchema = z.enum([
  'project_artifact',
  'production_experience',
  'open_source_pr',
  'code_review_demo',
  'system_design_doc',
  'mock_interview_score',
  'certification',
  'verbal_explanation',
]);

export const EvidenceValidationStatusSchema = z.enum([
  'unverified',
  'demonstrated',
  'validated_by_niva',
  'stale',
]);

export const ActivityTypeSchema = z.enum([
  'mock_interview',
  'system_design_practice',
  'coding_challenge',
  'rfc_writing',
  'concept_study',
  'behavioral_story_prep',
  'portfolio_project',
]);

export const ActivityStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'abandoned',
]);

export const ReadinessDiscrepancySchema = z.enum([
  'aligned',
  'overconfident',
  'underconfident',
  'unassessed',
]);

// --- Career Profile Validation ---

export const CareerCompensationRangeSchema = z.object({
  currency: z.string().min(1).max(8).default('USD'),
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const CreateCareerProfileSchema = z.object({
  headline: z.string().min(2).max(255),
  currentLevel: CareerLevelSchema,
  targetTimelineMonths: z.number().int().min(1).max(60).default(6),
  targetCompanyTiers: z.array(z.string().min(1).max(100)).default([]),
  targetLocations: z.array(z.string().min(1).max(100)).default([]),
  targetCompensationRange: CareerCompensationRangeSchema.nullable().optional(),
  statedReadiness: StatedReadinessSchema.default('early_preparation'),
  status: CareerStatusSchema.default('active_preparation'),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCareerProfileSchema = CreateCareerProfileSchema.partial();

// --- Target Role Validation ---

export const CreateTargetRoleSchema = z.object({
  title: z.string().min(2).max(255),
  roleFamily: RoleFamilySchema,
  seniorityLevel: SeniorityLevelSchema,
  priority: TargetRolePrioritySchema.default('primary'),
  targetCompanyTypes: z.array(z.string().min(1).max(100)).default([]),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateTargetRoleSchema = CreateTargetRoleSchema.partial();

// --- Career Skills & Link Validation ---

export const CreateSkillSchema = z.object({
  name: z.string().min(2).max(150),
  category: SkillCategorySchema,
  description: z.string().max(1000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const LinkRoleSkillSchema = z.object({
  skillId: z.string().uuid(),
  importance: SkillImportanceSchema.default('high_priority'),
  minimumProficiency: SkillProficiencySchema.default('intermediate'),
});

// --- User Skill & Evidence Validation ---

export const CreateUserSkillSchema = z.object({
  skillId: z.string().uuid(),
  selfRating: SkillProficiencySchema.default('intermediate'),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  lastPracticedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateUserSkillSchema = z.object({
  selfRating: SkillProficiencySchema.optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
  lastPracticedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const CreateSkillEvidenceSchema = z.object({
  evidenceType: EvidenceTypeSchema,
  title: z.string().min(2).max(255),
  description: z.string().min(2).max(3000),
  url: z.string().url().max(1000).nullable().optional(),
  validationStatus: EvidenceValidationStatusSchema.default('unverified'),
});

// --- Preparation Activity Validation ---

export const CreatePreparationActivitySchema = z.object({
  targetRoleId: z.string().uuid().nullable().optional(),
  skillId: z.string().uuid().nullable().optional(),
  activityType: ActivityTypeSchema,
  title: z.string().min(2).max(255),
  status: ActivityStatusSchema.default('planned'),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  outcomeNotes: z.string().max(3000).nullable().optional(),
  performanceScore: z.number().int().min(0).max(100).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

export const UpdatePreparationActivitySchema = z.object({
  title: z.string().min(2).max(255).optional(),
  status: ActivityStatusSchema.optional(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  outcomeNotes: z.string().max(3000).nullable().optional(),
  performanceScore: z.number().int().min(0).max(100).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

export const EvaluateGapAnalysisSchema = z.object({
  targetRoleId: z.string().uuid().optional(),
});

// ==========================================
// PHASE 6B: PLACEMENT STRATEGY & MOCK EVALUATIONS
// ==========================================

export const PlacementPriorityLevelSchema = z.enum(['critical', 'high', 'medium', 'low']);

export const MockEvaluationTypeSchema = z.enum([
  'technical',
  'behavioral',
  'system_design',
  'skill_assessment',
]);

export const EvaluationDifficultySchema = z.enum(['foundation', 'intermediate', 'advanced']);

export const EvaluationSessionStatusSchema = z.enum([
  'started',
  'in_progress',
  'completed',
  'abandoned',
]);

export const EvaluationDimensionRatingSchema = z.enum([
  'strong',
  'adequate',
  'developing',
  'insufficient',
]);

export const EvaluationStructuredDimensionSchema = z.object({
  dimension: z.enum([
    'technical_correctness',
    'reasoning',
    'communication',
    'depth',
    'completeness',
  ]),
  rating: EvaluationDimensionRatingSchema,
  feedback: z.string().max(2000),
});

export const AnswerEvaluationResultSchema = z.object({
  overallRating: EvaluationDimensionRatingSchema,
  dimensions: z.array(EvaluationStructuredDimensionSchema),
  strengths: z.array(z.string().max(500)),
  gaps: z.array(z.string().max(500)),
  followUpNeeded: z.boolean(),
  suggestedNextDifficulty: EvaluationDifficultySchema,
  feedbackNotes: z.string().max(3000),
  evidenceSummary: z.string().max(1000).nullable().optional(),
});

export const StartMockSessionSchema = z.object({
  targetRoleId: z.string().uuid().optional(),
  skillId: z.string().uuid().optional(),
  evaluationType: MockEvaluationTypeSchema.default('technical'),
  initialDifficulty: EvaluationDifficultySchema.default('intermediate'),
  totalPlannedQuestions: z.number().int().min(1).max(10).default(3),
});

export const SubmitEvaluationAnswerSchema = z.object({
  answerText: z.string().min(1).max(8000),
});

export const GenerateInterviewQuestionResponseSchema = z.object({
  questionText: z.string().min(5).max(3000),
  difficulty: EvaluationDifficultySchema,
  targetedSkill: z.string().min(1).max(150),
  contextRationale: z.string().max(2000),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.number(),
});

export const EvaluateInterviewAnswerResponseSchema = z.object({
  overallRating: EvaluationDimensionRatingSchema,
  dimensions: z.array(EvaluationStructuredDimensionSchema),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  followUpNeeded: z.boolean(),
  suggestedNextDifficulty: EvaluationDifficultySchema,
  feedbackNotes: z.string(),
  evidenceSummary: z.string().nullable().optional(),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.number(),
});

