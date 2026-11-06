import { z } from 'zod';

export const CompanionTriggerSourceSchema = z.enum([
  'conversation',
  'event',
  'proactive_evaluation',
]);

export const CompanionTriggerSchema = z.object({
  source: CompanionTriggerSourceSchema,
  userId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AdaptiveResponseModeSchema = z.enum([
  'acknowledge',
  'encourage',
  'challenge',
  'clarify',
  'coach',
  'study',
  'reflect',
  'silent',
]);

export const CompanionDecisionTypeSchema = z.enum([
  'respond',
  'ask',
  'encourage',
  'challenge',
  'acknowledge',
  'defer',
  'proactive',
  'no_action',
]);

export const BehavioralSignalTypeSchema = z.enum([
  'repeated_postponement',
  'overdue_commitments',
  'high_urgency_due',
  'high_momentum',
  'interaction_gap',
  'proactive_fatigue',
]);

export const BehavioralSignalSchema = z.object({
  type: BehavioralSignalTypeSchema,
  count: z.number().int().nonnegative(),
  windowDays: z.number().int().positive(),
  summary: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export const CompanionDecisionSchema = z.object({
  decision: CompanionDecisionTypeSchema,
  mode: AdaptiveResponseModeSchema,
  priority: z.enum(['low', 'normal', 'high']),
  rationale: z.string().min(1),
  interventionWarranted: z.boolean(),
  behavioralSignals: z.array(BehavioralSignalSchema).optional(),
  actionId: z.string().uuid().optional(),
  messageContent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
