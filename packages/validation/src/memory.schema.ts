import { z } from 'zod';

export const MemoryCategorySchema = z.enum([
  'semantic_fact',
  'user_preference',
  'episodic_event',
  'open_loop',
]);

export const ConfidenceTypeSchema = z.enum(['explicit', 'inferred']);

export const MemoryCandidateStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'failed',
  'deferred',
]);

export const MemoryStatusSchema = z.enum([
  'active',
  'superseded',
  'archived',
  'deleted',
]);

export const MemoryExtractionJobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const EvaluationDecisionSchema = z.enum([
  'accept',
  'reject',
  'supersede',
  'defer',
]);

export const CreateMemoryExtractionJobSchema = z.object({
  userId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  status: MemoryExtractionJobStatusSchema.default('pending'),
  turnContext: z.record(z.unknown()).optional().default({}),
});

export const CreateMemoryCandidateSchema = z.object({
  userId: z.string().uuid(),
  jobId: z.string().uuid().nullable().optional(),
  sourceConversationId: z.string().uuid().nullable().optional(),
  sourceMessageId: z.string().uuid().nullable().optional(),
  category: MemoryCategorySchema,
  content: z.string().trim().min(3).max(1000),
  confidence: z.number().min(0.0).max(1.0),
  confidenceType: ConfidenceTypeSchema,
  status: MemoryCandidateStatusSchema.default('pending'),
  rejectionReason: z.string().max(255).nullable().optional(),
  importance: z.number().int().min(1).max(10).default(5),
  rationale: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const CreateMemorySchema = z.object({
  userId: z.string().uuid(),
  candidateId: z.string().uuid().nullable().optional(),
  category: MemoryCategorySchema,
  content: z.string().trim().min(3).max(1000),
  confidence: z.number().min(0.0).max(1.0),
  confidenceType: ConfidenceTypeSchema,
  status: MemoryStatusSchema.default('active'),
  sourceType: z.enum(['conversation', 'manual_user', 'onboarding']).default('conversation'),
  sourceConversationId: z.string().uuid().nullable().optional(),
  sourceMessageId: z.string().uuid().nullable().optional(),
  supersededById: z.string().uuid().nullable().optional(),
  importance: z.number().int().min(1).max(10).default(5),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const ListMemoriesQuerySchema = z.object({
  status: MemoryStatusSchema.optional().default('active'),
  category: MemoryCategorySchema.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

// ==============================================================================
// Phase 3B: AI Extraction & Embedding Boundary Schemas
// ==============================================================================

export const ExtractedMemoryCandidateItemSchema = z.object({
  category: MemoryCategorySchema,
  content: z.string().trim().min(3, 'Memory content must be at least 3 characters').max(1000, 'Memory content must not exceed 1000 characters'),
  confidence: z.number().min(0.0, 'Confidence cannot be less than 0.0').max(1.0, 'Confidence cannot exceed 1.0'),
  confidenceType: ConfidenceTypeSchema,
  importance: z.number().int().min(1).max(10).default(5),
  rationale: z.string().nullable().optional().default(null),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const ExtractMemoryCandidatesRequestSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  userMessage: z.string().min(1, 'User message cannot be empty').max(8000),
  recentHistory: z
    .array(
      z.object({
        senderRole: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .optional()
    .default([]),
  characterPersona: z
    .object({
      name: z.string(),
      archetypeId: z.string(),
    })
    .nullable()
    .optional()
    .default(null),
  requestId: z.string().optional(),
});

export const ExtractMemoryCandidatesResponseSchema = z.object({
  candidates: z.array(ExtractedMemoryCandidateItemSchema),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.number(),
  requestId: z.string(),
  extractedCount: z.number().int().min(0),
});

export const GenerateEmbeddingRequestSchema = z.object({
  text: z.string().trim().min(1, 'Text to embed cannot be empty').max(8000),
  memoryId: z.string().uuid().optional(),
  requestId: z.string().optional(),
});

export const GenerateEmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()).length(768, 'Embedding must be exactly 768 dimensions'),
  provider: z.string(),
  model: z.string(),
  dimensions: z.literal(768),
  latencyMs: z.number(),
  requestId: z.string(),
});

export const CreateMemoryEmbeddingSchema = z.object({
  memoryId: z.string().uuid(),
  userId: z.string().uuid(),
  embedding: z.array(z.number()).length(768, 'Embedding must be exactly 768 dimensions'),
  provider: z.string().default('gemini'),
  model: z.string().default('text-embedding-004'),
  dimensions: z.literal(768).default(768),
  metadata: z.record(z.unknown()).optional().default({}),
});

// ==============================================================================
// Phase 3C: Memory Evaluation & Lifecycle Schemas
// ==============================================================================

export const RelatedMemoryContextSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(1000),
  category: MemoryCategorySchema,
  similarity: z.number().min(0.0).max(1.0).optional(),
});

export const EvaluateMemoryCandidateRequestSchema = z.object({
  candidateId: z.string().uuid(),
  category: MemoryCategorySchema,
  content: z.string().trim().min(3).max(1000),
  confidence: z.number().min(0.0).max(1.0),
  confidenceType: ConfidenceTypeSchema,
  existingMemories: z.array(RelatedMemoryContextSchema).optional().default([]),
  context: z.record(z.unknown()).optional().default({}),
  requestId: z.string().optional(),
});

export const EvaluateMemoryCandidateResponseSchema = z.object({
  candidateId: z.string().uuid(),
  decision: EvaluationDecisionSchema,
  reason: z.string().min(1).max(1000),
  confidence: z.number().min(0.0).max(1.0),
  supersedesMemoryId: z.string().uuid().nullable().optional().default(null),
  duplicateOfMemoryId: z.string().uuid().nullable().optional().default(null),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.number(),
  requestId: z.string(),
});

// ==============================================================================
// Phase 3D: Memory Retrieval & ContextFrame Integration Schemas
// ==============================================================================

export const RelevantMemorySchema = z.object({
  id: z.string().uuid(),
  category: MemoryCategorySchema,
  content: z.string().min(1).max(1000),
  confidence: z.number().min(0.0).max(1.0),
  confidenceType: ConfidenceTypeSchema,
  importance: z.number().int().min(1).max(10),
  relevanceScore: z.number().min(0.0).max(1.0),
  similarity: z.number().min(0.0).max(1.0),
  lastReinforcedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const MemoryRetrievalOptionsSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().default(5),
  minSimilarity: z.number().min(0.0).max(1.0).optional().default(0.60),
  maxTokens: z.number().int().min(50).max(2000).optional().default(400),
  requireActive: z.boolean().optional().default(true),
});

export const MemoryRetrievalResultSchema = z.object({
  memories: z.array(RelevantMemorySchema),
  totalRetrieved: z.number().int().min(0),
  tokenCountEstimated: z.number().int().min(0),
  queryLatencyMs: z.number().min(0),
});

