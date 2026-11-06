/**
 * Phase 3A, 3B & 3C: Persistent Memory Foundation Types
 * DTOs, Enums, and contracts for Recoverable Extraction Jobs, Memory Candidates,
 * Durable Memories, Vector Embeddings, AI Extraction, and Candidate Evaluation Boundaries.
 */

export type MemoryCategory =
  | 'semantic_fact'
  | 'user_preference'
  | 'episodic_event'
  | 'open_loop';

export type ConfidenceType = 'explicit' | 'inferred';

export type MemoryCandidateStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'deferred';

export type MemoryStatus = 'active' | 'superseded' | 'archived' | 'deleted';

export type MemoryExtractionJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type MemorySourceType = 'conversation' | 'manual_user' | 'onboarding';

export type EvaluationDecision = 'accept' | 'reject' | 'supersede' | 'defer';

export interface MemoryExtractionJobDto {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string | null;
  status: MemoryExtractionJobStatus;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  turnContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface MemoryCandidateDto {
  id: string;
  userId: string;
  jobId: string | null;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  category: MemoryCategory;
  content: string;
  confidence: number;
  confidenceType: ConfidenceType;
  status: MemoryCandidateStatus;
  rejectionReason: string | null;
  importance: number;
  rationale: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryDto {
  id: string;
  userId: string;
  candidateId: string | null;
  category: MemoryCategory;
  content: string;
  confidence: number;
  confidenceType: ConfidenceType;
  status: MemoryStatus;
  sourceType: MemorySourceType;
  sourceConversationId: string | null;
  sourceConversationTitle?: string | null;
  sourceMessageId: string | null;
  supersededById: string | null;
  reinforcementCount: number;
  lastReinforcedAt: string;
  validFrom: string | null;
  validUntil: string | null;
  importance: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListMemoriesQuery {
  status?: MemoryStatus;
  category?: MemoryCategory;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListMemoriesResponseDto {
  items: MemoryDto[];
  total: number;
}

export interface MemoryEmbeddingDto {
  id: string;
  memoryId: string;
  userId: string;
  provider: string;
  model: string;
  dimensions: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ==============================================================================
// Phase 3B: AI Extraction & Embedding Boundary Contracts
// ==============================================================================

export interface ExtractedMemoryCandidateItem {
  category: MemoryCategory;
  content: string;
  confidence: number;
  confidenceType: ConfidenceType;
  importance: number;
  rationale: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExtractMemoryCandidatesRequestDto {
  conversationId: string;
  messageId?: string | null;
  userMessage: string;
  recentHistory?: Array<{ senderRole: 'user' | 'assistant'; content: string }>;
  characterPersona?: { name: string; archetypeId: string } | null;
  requestId?: string;
}

export interface ExtractMemoryCandidatesResponseDto {
  candidates: ExtractedMemoryCandidateItem[];
  provider: string;
  model: string;
  latencyMs: number;
  requestId: string;
  extractedCount: number;
}

export interface GenerateEmbeddingRequestDto {
  text: string;
  memoryId?: string;
  requestId?: string;
}

export interface GenerateEmbeddingResponseDto {
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
  latencyMs: number;
  requestId: string;
}

export interface ProcessExtractionJobResultDto {
  job: MemoryExtractionJobDto;
  candidatesCreated: MemoryCandidateDto[];
  extractedCount: number;
}

// ==============================================================================
// Phase 3C: Memory Evaluation & Lifecycle Contracts
// ==============================================================================

export interface RelatedMemoryContext {
  id: string;
  content: string;
  category: MemoryCategory;
  similarity?: number;
}

export interface EvaluateMemoryCandidateRequestDto {
  candidateId: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  confidenceType: ConfidenceType;
  existingMemories?: RelatedMemoryContext[];
  context?: Record<string, unknown>;
  requestId?: string;
}

export interface EvaluateMemoryCandidateResponseDto {
  candidateId: string;
  decision: EvaluationDecision;
  reason: string;
  confidence: number;
  supersedesMemoryId?: string | null;
  duplicateOfMemoryId?: string | null;
  provider: string;
  model: string;
  latencyMs: number;
  requestId: string;
}

export interface EvaluateCandidateResultDto {
  candidate: MemoryCandidateDto;
  decision: EvaluationDecision;
  reason: string;
  durableMemory?: MemoryDto | null;
  supersededMemory?: MemoryDto | null;
  reinforcedMemory?: MemoryDto | null;
  embeddingCreated: boolean;
}

// ==============================================================================
// Phase 3D: Memory Retrieval & ContextFrame Integration Contracts
// ==============================================================================

export interface RelevantMemoryDto {
  id: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  confidenceType: ConfidenceType;
  importance: number;
  relevanceScore: number;
  similarity: number;
  lastReinforcedAt: string;
  createdAt: string;
}

export interface MemoryRetrievalOptions {
  limit?: number;
  minSimilarity?: number;
  maxTokens?: number;
  requireActive?: boolean;
}

export interface MemoryRetrievalResultDto {
  memories: RelevantMemoryDto[];
  totalRetrieved: number;
  tokenCountEstimated: number;
  queryLatencyMs: number;
}

