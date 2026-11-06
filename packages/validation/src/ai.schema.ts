import { z } from 'zod';

export const CompanionAiUsageSchema = z.object({
  inputTokens: z.number().nullable().optional(),
  outputTokens: z.number().nullable().optional(),
  totalTokens: z.number().nullable().optional(),
});

export const GenerateCompanionReplySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation UUID'),
  userMessage: z.string().trim().min(1, 'User message cannot be empty').max(8000, 'User message exceeds 8,000 characters'),
  contextFrame: z.record(z.unknown()),
  temperature: z.number().min(0.0).max(2.0).optional().default(0.7),
  maxOutputTokens: z.number().int().min(1).max(8192).optional().default(2048),
  requestId: z.string().optional(),
});

export const CompanionAiResponseSchema = z.object({
  content: z.string().min(1, 'Generated content cannot be empty'),
  provider: z.string(),
  model: z.string(),
  usage: CompanionAiUsageSchema,
  latencyMs: z.number().nonnegative(),
  requestId: z.string(),
  finishReason: z.string().nullable().optional(),
});

export type GenerateCompanionReplyInput = z.infer<typeof GenerateCompanionReplySchema>;
export type CompanionAiResponseInput = z.infer<typeof CompanionAiResponseSchema>;
