import { z } from 'zod';

export const ConversationStatusEnum = z.enum(['active', 'archived']);

export const MessageSenderRoleEnum = z.enum(['user', 'assistant', 'system']);

export const MessageStatusEnum = z.enum(['complete', 'deleted']);

export const CreateConversationSchema = z.object({
  characterId: z
    .string()
    .trim()
    .min(1, 'Character ID cannot be empty')
    .max(50, 'Character ID cannot exceed 50 characters'),
  title: z
    .string()
    .trim()
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateConversationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(255, 'Title must not exceed 255 characters')
      .optional(),
    status: ConversationStatusEnum.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.status !== undefined ||
      data.metadata !== undefined,
    {
      message: 'At least one field must be provided for update',
    },
  );

export const CreateMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(8000, 'Message content must not exceed 8,000 characters'),
  metadata: z.record(z.unknown()).optional(),
});

export const ListConversationsQuerySchema = z.object({
  status: ConversationStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const ListMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
  direction: z.enum(['forward', 'backward']).default('forward').optional(),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>;
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;
export type ListConversationsQueryInput = z.infer<
  typeof ListConversationsQuerySchema
>;
export type ListMessagesQueryInput = z.infer<typeof ListMessagesQuerySchema>;
