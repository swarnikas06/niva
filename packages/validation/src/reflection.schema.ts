import { z } from 'zod';

export const observationCategorySchema = z.enum([
  'progress',
  'recurrence',
  'intention_vs_outcome',
  'unresolved_thread',
  'priority_change',
  'learning_development',
  'career_development',
  'decision_follow_up',
  'user_correction',
]);

export const observationStatusSchema = z.enum([
  'active',
  'confirmed',
  'corrected',
  'dismissed',
  'superseded',
]);

export const observationConfidenceTypeSchema = z.enum([
  'explicit_statement',
  'inferred_pattern',
]);

export const evidenceSourceTypeSchema = z.enum([
  'domain_events',
  'study_sessions',
  'learning_difficulties',
  'life_tasks',
  'life_commitments',
  'career_evaluations',
  'conversation_messages',
]);

export const supportingEvidenceRefSchema = z.object({
  sourceType: evidenceSourceTypeSchema,
  entityId: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  label: z.string().min(1).max(255),
  snippet: z.string().max(1000).optional(),
});

export const createLongitudinalObservationSchema = z.object({
  category: observationCategorySchema,
  title: z.string().min(3).max(255),
  fact: z.string().min(5).max(3000),
  interpretation: z.string().min(5).max(3000),
  supportingEvidence: z.array(supportingEvidenceRefSchema).min(1),
  timeWindowStart: z.string(),
  timeWindowEnd: z.string(),
  windowDays: z.number().int().min(1).max(365),
  confidence: z.number().min(0).max(1).default(0.8),
  confidenceType: observationConfidenceTypeSchema.default('inferred_pattern'),
});

export const correctObservationSchema = z.object({
  correctionNotes: z.string().min(3).max(2000),
});

export const generateReflectionQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(90).default(14),
});
