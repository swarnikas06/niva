import { ContextFrameDto } from './context.js';
import { ConversationMessageDto } from './conversation.js';

/**
 * Request payload sent from NestJS API Gateway to FastAPI AI Service.
 */
export interface GenerateCompanionReplyRequestDto {
  conversationId: string;
  userMessage: string;
  contextFrame: ContextFrameDto;
  temperature?: number;
  maxOutputTokens?: number;
  requestId?: string;
}

/**
 * Token usage metadata returned by AI provider (where available).
 */
export interface CompanionAiUsageDto {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

/**
 * Standardized AI generation response from FastAPI AI Service.
 */
export interface CompanionAiResponseDto {
  content: string;
  provider: string;
  model: string;
  usage: CompanionAiUsageDto;
  latencyMs: number;
  requestId: string;
  finishReason?: string | null;
}

/**
 * Turn result returned by NestJS when a message is sent and a reply is generated.
 */
export interface ConversationTurnResultDto {
  userMessage: ConversationMessageDto;
  assistantMessage: ConversationMessageDto;
  metadata?: {
    provider: string;
    model: string;
    tokensUsed?: number | null;
    latencyMs: number;
  };
  decision?: import('./orchestration.js').CompanionDecisionDto;
  conversationTitle?: string;
  executedActions?: import('./context.js').ExecutedActionOutcomeDto[];
}
