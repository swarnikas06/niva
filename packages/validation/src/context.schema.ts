import { z } from 'zod';

export const CompanionPresenceStatusEnum = z.enum([
  'active',
  'idle',
  'focused',
  'reflecting',
]);

export const InteractionModeEnum = z.enum([
  'chat',
  'study',
  'planning',
  'review',
  'silent',
]);


export const UpdateCompanionStateSchema = z.object({
  presenceStatus: CompanionPresenceStatusEnum.optional(),
  interactionMode: InteractionModeEnum.optional(),
  activeFocusGoalId: z.string().uuid().nullable().optional(),
  activeFocusProjectId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateCompanionStateInput = z.infer<typeof UpdateCompanionStateSchema>;

export const AssembleContextQuerySchema = z.object({
  conversationId: z.string().uuid().optional(),
  maxTokens: z.coerce.number().int().min(500).max(32000).default(4000),
  persistSnapshot: z.preprocess((val) => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return val;
  }, z.boolean().default(false)),
  triggerReason: z.string().max(50).default('manual_query'),
  currentMessage: z.string().max(8000).optional(),
  memoryTokenBudget: z.coerce.number().int().min(50).max(2000).default(400),
});

export type AssembleContextQueryInput = z.infer<typeof AssembleContextQuerySchema>;
