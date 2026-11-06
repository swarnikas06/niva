import { z } from 'zod';

export const DomainEventTypeSchema = z.enum([
  'UserMessageSent',
  'TaskCreated',
  'TaskCompleted',
  'TaskPostponed',
  'CommitmentCreated',
  'CommitmentUpdated',
  'MemoryAccepted',
  'MemorySuperseded',
  'CareerProfileUpdated',
  'TargetRoleCreated',
  'SkillEvidenceAdded',
  'PreparationActivityCompleted',
  'CareerGapEvaluated',
]);

export const EventProcessingStatusSchema = z.enum([
  'pending',
  'processing',
  'processed',
  'failed',
  'dead_letter',
]);

export const AggregateTypeSchema = z.enum([
  'conversation',
  'task',
  'commitment',
  'memory',
  'goal',
  'project',
  'career_profile',
  'target_role',
  'career_skill',
  'preparation_activity',
]);

export const CreateDomainEventSchema = z.object({
  userId: z.string().uuid(),
  eventType: DomainEventTypeSchema,
  eventVersion: z.number().int().min(1).default(1),
  aggregateType: AggregateTypeSchema,
  aggregateId: z.string().min(1).max(128),
  payload: z.record(z.unknown()).default({}),
  occurredAt: z.string().datetime().optional(),
});

export const CandidateUrgencySchema = z.enum(['low', 'medium', 'high']);
export const ProactiveCandidateStatusSchema = z.enum(['pending', 'evaluated', 'discarded']);
export const PolicyDecisionTypeSchema = z.enum(['NO_ACTION', 'DEFER', 'ACT']);

export const ProactiveActionTypeSchema = z.enum(['IN_APP_MESSAGE', 'IN_APP_PROMPT']);
export const ProactiveActionStatusSchema = z.enum([
  'pending_delivery',
  'delivered',
  'dismissed',
  'acted_upon',
]);

export const UpdateUserProactivePreferencesSchema = z.object({
  proactiveEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (00:00 - 23:59)').optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (00:00 - 23:59)').optional(),
  timezone: z.string().min(1).max(64).optional(),
  maxDailyInteractions: z.number().int().min(1).max(10).optional(),
  allowHighUrgencyInQuietHours: z.boolean().optional(),
});

export const ProcessEventsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});
