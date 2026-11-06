import {
  Injectable,
  Logger,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  GenerateCompanionReplyRequestDto,
  CompanionAiResponseDto,
  ExtractMemoryCandidatesRequestDto,
  ExtractMemoryCandidatesResponseDto,
  GenerateEmbeddingRequestDto,
  GenerateEmbeddingResponseDto,
  EvaluateMemoryCandidateRequestDto,
  EvaluateMemoryCandidateResponseDto,
  GenerateInterviewQuestionRequestDto,
  GenerateInterviewQuestionResponseDto,
  EvaluateInterviewAnswerRequestDto,
  EvaluateInterviewAnswerResponseDto,
} from '@niva/shared-types';
import {
  CompanionAiResponseSchema,
  ExtractMemoryCandidatesResponseSchema,
  GenerateEmbeddingResponseSchema,
  EvaluateMemoryCandidateResponseSchema,
  GenerateInterviewQuestionResponseSchema,
  EvaluateInterviewAnswerResponseSchema,
} from '@niva/validation';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly aiServiceUrl: string;
  private readonly internalSecret: string;
  private readonly timeoutMs: number;

  constructor() {
    this.aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
    const isProd = process.env.NODE_ENV === 'production';
    const secret = process.env.NIVA_INTERNAL_SECRET?.trim();

    if (isProd) {
      if (
        !secret ||
        secret === 'niva_internal_secret_change_in_production_32c' ||
        secret.length < 32
      ) {
        throw new Error(
          '[FATAL SECURITY MISCONFIGURATION] NIVA_INTERNAL_SECRET must be configured with a cryptographically secure value (minimum 32 characters) in production. Unsafe default fallback rejected.',
        );
      }
      this.internalSecret = secret;
    } else {
      this.internalSecret = secret || 'niva_internal_secret_change_in_production_32c';
    }

    this.timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '90000', 10);
  }

  /**
   * Dispatches generation request to internal FastAPI AI Service.
   */
  async generateCompanionReply(
    payload: GenerateCompanionReplyRequestDto,
  ): Promise<CompanionAiResponseDto> {
    const requestId = payload.requestId || crypto.randomUUID();
    const endpoint = `${this.aiServiceUrl}/api/v1/companion/generate-reply`;

    this.logger.debug(`[${requestId}] Dispatching AI generation request to ${endpoint}`);

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Niva-Internal-Secret': this.internalSecret,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            conversationId: payload.conversationId,
            userMessage: payload.userMessage,
            contextFrame: payload.contextFrame,
            temperature: payload.temperature ?? 0.7,
            maxOutputTokens: payload.maxOutputTokens ?? 2048,
            requestId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDetail = (errorBody as any)?.detail || response.statusText;

          this.logger.warn(
            `[${requestId}] AI service returned HTTP ${response.status}: ${JSON.stringify(errorDetail)} (attempt ${attempt}/${maxAttempts})`,
          );

          if (response.status === 429) {
            throw new HttpException(
              'AI generation rate limit or quota exceeded. Please wait a moment.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }

          if (response.status === 504) {
            throw new GatewayTimeoutException('AI generation timed out');
          }

          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          throw new BadGatewayException(`AI service error: ${errorDetail}`);
        }

        const rawJson = await response.json();
        const parseResult = CompanionAiResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          this.logger.error(
            `[${requestId}] Invalid response schema from AI service: ${parseResult.error.message}`,
          );
          throw new BadGatewayException('Malformed response received from AI service');
        }

        const data = parseResult.data as CompanionAiResponseDto;

        this.logger.log(
          `[${requestId}] Companion response generated via ${data.provider} (${data.model}) in ${data.latencyMs}ms`,
        );

        return data;
      } catch (err: any) {
        lastError = err;

        if (err.name === 'AbortError') {
          this.logger.error(`[${requestId}] AI service call timed out after ${this.timeoutMs}ms`);
          throw new GatewayTimeoutException(
            `AI service request timed out after ${this.timeoutMs}ms`,
          );
        }

        if (err instanceof HttpException) {
          throw err;
        }

        this.logger.warn(
          `[${requestId}] AI service network failure on attempt ${attempt}/${maxAttempts}: ${err.message}`,
        );

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    this.logger.error(`[${requestId}] Failed to reach AI service after ${maxAttempts} attempts`);
    throw new BadGatewayException(
      `Unable to reach AI service: ${lastError?.message || 'Network failure'}`,
    );
  }

  /**
   * Phase 3B: Dispatches memory extraction request to FastAPI AI Service.
   */
  async extractMemoryCandidates(
    payload: ExtractMemoryCandidatesRequestDto,
  ): Promise<ExtractMemoryCandidatesResponseDto> {
    const requestId = payload.requestId || crypto.randomUUID();
    const endpoint = `${this.aiServiceUrl}/api/v1/companion/extract-memories`;

    this.logger.debug(`[${requestId}] Dispatching memory extraction request to ${endpoint}`);

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Niva-Internal-Secret': this.internalSecret,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            conversationId: payload.conversationId,
            messageId: payload.messageId || null,
            userMessage: payload.userMessage,
            recentHistory: payload.recentHistory || [],
            characterPersona: payload.characterPersona || null,
            requestId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDetail = (errorBody as any)?.detail || response.statusText;

          this.logger.warn(
            `[${requestId}] AI service returned HTTP ${response.status} during memory extraction: ${JSON.stringify(errorDetail)}`,
          );

          if (response.status === 429) {
            throw new HttpException(
              'AI memory extraction rate limit exceeded. Please wait a moment.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }

          if (response.status === 504) {
            throw new GatewayTimeoutException('AI memory extraction timed out');
          }

          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          throw new BadGatewayException(`AI memory extraction error: ${errorDetail}`);
        }

        const rawJson = await response.json();
        const parseResult = ExtractMemoryCandidatesResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          this.logger.error(
            `[${requestId}] Invalid memory extraction response schema from AI service: ${parseResult.error.message}`,
          );
          throw new BadGatewayException('Malformed memory extraction response received from AI service');
        }

        const data = parseResult.data as ExtractMemoryCandidatesResponseDto;

        this.logger.log(
          `[${requestId}] Extracted ${data.extractedCount} candidate memories via ${data.provider} (${data.model}) in ${data.latencyMs}ms`,
        );

        return data;
      } catch (err: any) {
        lastError = err;

        if (err.name === 'AbortError') {
          this.logger.error(`[${requestId}] AI memory extraction timed out after ${this.timeoutMs}ms`);
          throw new GatewayTimeoutException(
            `AI memory extraction timed out after ${this.timeoutMs}ms`,
          );
        }

        if (err instanceof HttpException) {
          throw err;
        }

        this.logger.warn(
          `[${requestId}] AI memory extraction network failure on attempt ${attempt}/${maxAttempts}: ${err.message}`,
        );

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    this.logger.error(`[${requestId}] Failed to reach AI service for memory extraction after ${maxAttempts} attempts`);
    throw new BadGatewayException(
      `Unable to reach AI service for memory extraction: ${lastError?.message || 'Network failure'}`,
    );
  }

  /**
   * Phase 3B: Dispatches embedding generation request to FastAPI AI Service.
   */
  async generateEmbedding(
    payload: GenerateEmbeddingRequestDto,
  ): Promise<GenerateEmbeddingResponseDto> {
    const requestId = payload.requestId || crypto.randomUUID();
    const endpoint = `${this.aiServiceUrl}/api/v1/companion/embed`;

    this.logger.debug(`[${requestId}] Dispatching embedding request to ${endpoint}`);

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Niva-Internal-Secret': this.internalSecret,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            text: payload.text,
            memoryId: payload.memoryId || null,
            requestId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDetail = (errorBody as any)?.detail || response.statusText;

          this.logger.warn(
            `[${requestId}] AI service returned HTTP ${response.status} during embedding: ${JSON.stringify(errorDetail)}`,
          );

          if (response.status === 429) {
            throw new HttpException(
              'AI embedding rate limit exceeded. Please wait a moment.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }

          if (response.status === 504) {
            throw new GatewayTimeoutException('AI embedding timed out');
          }

          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          throw new BadGatewayException(`AI embedding error: ${errorDetail}`);
        }

        const rawJson = await response.json();
        const parseResult = GenerateEmbeddingResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          this.logger.error(
            `[${requestId}] Invalid embedding response schema from AI service: ${parseResult.error.message}`,
          );
          throw new BadGatewayException('Malformed embedding response received from AI service');
        }

        const data = parseResult.data as GenerateEmbeddingResponseDto;

        this.logger.log(
          `[${requestId}] Generated ${data.dimensions}-dim embedding via ${data.provider} (${data.model}) in ${data.latencyMs}ms`,
        );

        return data;
      } catch (err: any) {
        lastError = err;

        if (err.name === 'AbortError') {
          this.logger.error(`[${requestId}] AI embedding call timed out after ${this.timeoutMs}ms`);
          throw new GatewayTimeoutException(
            `AI embedding request timed out after ${this.timeoutMs}ms`,
          );
        }

        if (err instanceof HttpException) {
          throw err;
        }

        this.logger.warn(
          `[${requestId}] AI embedding network failure on attempt ${attempt}/${maxAttempts}: ${err.message}`,
        );

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    this.logger.error(`[${requestId}] Failed to reach AI service for embedding after ${maxAttempts} attempts`);
    throw new BadGatewayException(
      `Unable to reach AI service for embedding: ${lastError?.message || 'Network failure'}`,
    );
  }

  /**
   * Phase 3C: Dispatches candidate evaluation request to FastAPI AI Service.
   */
  async evaluateMemoryCandidate(
    payload: EvaluateMemoryCandidateRequestDto,
  ): Promise<EvaluateMemoryCandidateResponseDto> {
    const requestId = payload.requestId || crypto.randomUUID();
    const endpoint = `${this.aiServiceUrl}/api/v1/companion/evaluate-candidate`;

    this.logger.debug(
      `[${requestId}] Dispatching candidate evaluation request for candidate ${payload.candidateId} to ${endpoint}`,
    );

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Niva-Internal-Secret': this.internalSecret,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            candidateId: payload.candidateId,
            category: payload.category,
            content: payload.content,
            confidence: payload.confidence,
            confidenceType: payload.confidenceType,
            existingMemories: payload.existingMemories || [],
            context: payload.context || {},
            requestId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDetail = (errorBody as any)?.detail || response.statusText;

          this.logger.warn(
            `[${requestId}] AI service returned HTTP ${response.status} during candidate evaluation: ${JSON.stringify(errorDetail)}`,
          );

          if (response.status === 429) {
            throw new HttpException(
              'AI evaluation rate limit exceeded. Please wait a moment.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }

          if (response.status === 504) {
            throw new GatewayTimeoutException('AI candidate evaluation timed out');
          }

          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          throw new BadGatewayException(`AI candidate evaluation error: ${errorDetail}`);
        }

        const rawJson = await response.json();
        const parseResult = EvaluateMemoryCandidateResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          this.logger.error(
            `[${requestId}] Invalid candidate evaluation response schema from AI service: ${parseResult.error.message}`,
          );
          throw new BadGatewayException('Malformed candidate evaluation response received from AI service');
        }

        const data = parseResult.data as EvaluateMemoryCandidateResponseDto;

        this.logger.log(
          `[${requestId}] Evaluated candidate ${data.candidateId} -> decision=${data.decision} via ${data.provider} (${data.model}) in ${data.latencyMs}ms`,
        );

        return data;
      } catch (err: any) {
        lastError = err;

        if (err.name === 'AbortError') {
          this.logger.error(`[${requestId}] AI candidate evaluation call timed out after ${this.timeoutMs}ms`);
          throw new GatewayTimeoutException(
            `AI candidate evaluation request timed out after ${this.timeoutMs}ms`,
          );
        }

        if (err instanceof HttpException) {
          throw err;
        }

        this.logger.warn(
          `[${requestId}] AI candidate evaluation network failure on attempt ${attempt}/${maxAttempts}: ${err.message}`,
        );

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    this.logger.error(
      `[${requestId}] Failed to reach AI service for candidate evaluation after ${maxAttempts} attempts`,
    );
    throw new BadGatewayException(
      `Unable to reach AI service for candidate evaluation: ${lastError?.message || 'Network failure'}`,
    );
  }

  /**
   * Generates a context-grounded mock interview question via internal FastAPI AI Service.
   */
  async generateInterviewQuestion(
    payload: GenerateInterviewQuestionRequestDto,
  ): Promise<GenerateInterviewQuestionResponseDto> {
    const requestId = payload.requestId || crypto.randomUUID();
    const endpoint = `${this.aiServiceUrl}/api/v1/career/generate-question`;

    this.logger.debug(`[${requestId}] Dispatching interview question generation request to ${endpoint}`);

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Niva-Internal-Secret': this.internalSecret,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            targetRole: payload.targetRole,
            skill: payload.skill,
            sessionType: payload.sessionType,
            difficulty: payload.difficulty,
            questionNumber: payload.questionNumber,
            totalQuestions: payload.totalQuestions,
            previousTurns: payload.previousTurns || [],
            relevantContext: payload.relevantContext || [],
            requestId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDetail = (errorBody as any)?.detail || response.statusText;

          this.logger.warn(
            `[${requestId}] AI service returned HTTP ${response.status} during question generation: ${JSON.stringify(errorDetail)}`,
          );

          if (response.status === 429) {
            throw new HttpException('AI rate limit exceeded. Please wait a moment.', HttpStatus.TOO_MANY_REQUESTS);
          }
          if (response.status === 504) {
            throw new GatewayTimeoutException('AI interview question generation timed out');
          }
          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          throw new BadGatewayException(`AI interview question generation error: ${errorDetail}`);
        }

        const rawJson = await response.json();
        const parseResult = GenerateInterviewQuestionResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          this.logger.error(
            `[${requestId}] Invalid question response schema from AI service: ${parseResult.error.message}`,
          );
          throw new BadGatewayException('Malformed interview question response received from AI service');
        }

        const data = parseResult.data as GenerateInterviewQuestionResponseDto;
        this.logger.log(
          `[${requestId}] Generated interview question on '${data.targetedSkill}' (${data.difficulty}) via ${data.provider} in ${data.latencyMs}ms`,
        );
        return data;
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') {
          throw new GatewayTimeoutException(`AI question generation timed out after ${this.timeoutMs}ms`);
        }
        if (err instanceof HttpException) throw err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    throw new BadGatewayException(
      `Unable to reach AI service for interview question generation: ${lastError?.message || 'Network failure'}`,
    );
  }

  /**
   * Evaluates a candidate mock interview answer across structured dimensions via internal FastAPI AI Service.
   */
  async evaluateInterviewAnswer(
    payload: EvaluateInterviewAnswerRequestDto,
  ): Promise<EvaluateInterviewAnswerResponseDto> {
    const requestId = payload.requestId || crypto.randomUUID();
    const endpoint = `${this.aiServiceUrl}/api/v1/career/evaluate-answer`;

    this.logger.debug(`[${requestId}] Dispatching interview answer evaluation request to ${endpoint}`);

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Niva-Internal-Secret': this.internalSecret,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            targetRole: payload.targetRole,
            skill: payload.skill,
            sessionType: payload.sessionType,
            difficulty: payload.difficulty,
            questionText: payload.questionText,
            userAnswer: payload.userAnswer,
            requestId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDetail = (errorBody as any)?.detail || response.statusText;

          this.logger.warn(
            `[${requestId}] AI service returned HTTP ${response.status} during answer evaluation: ${JSON.stringify(errorDetail)}`,
          );

          if (response.status === 429) {
            throw new HttpException('AI rate limit exceeded. Please wait a moment.', HttpStatus.TOO_MANY_REQUESTS);
          }
          if (response.status === 504) {
            throw new GatewayTimeoutException('AI interview answer evaluation timed out');
          }
          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          throw new BadGatewayException(`AI interview answer evaluation error: ${errorDetail}`);
        }

        const rawJson = await response.json();
        const parseResult = EvaluateInterviewAnswerResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          this.logger.error(
            `[${requestId}] Invalid answer evaluation response schema from AI service: ${parseResult.error.message}`,
          );
          throw new BadGatewayException('Malformed interview answer evaluation response received from AI service');
        }

        const data = parseResult.data as EvaluateInterviewAnswerResponseDto;
        this.logger.log(
          `[${requestId}] Evaluated candidate answer -> overallRating='${data.overallRating}' via ${data.provider} in ${data.latencyMs}ms`,
        );
        return data;
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') {
          throw new GatewayTimeoutException(`AI answer evaluation timed out after ${this.timeoutMs}ms`);
        }
        if (err instanceof HttpException) throw err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    throw new BadGatewayException(
      `Unable to reach AI service for interview answer evaluation: ${lastError?.message || 'Network failure'}`,
    );
  }

  /**
   * Generates a concise 2-5 word topic title from an initial user message.
   */
  async generateConversationTitle(userMessage: string): Promise<string> {
    const fallbackWords = userMessage
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !['the', 'and', 'for', 'with', 'about', 'how', 'can', 'you', 'help', 'what', 'need'].includes(
            w.toLowerCase(),
          ),
      );

    const fallbackTitle =
      fallbackWords.length > 0
        ? fallbackWords
            .slice(0, 4)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : 'Discussion';

    try {
      const endpoint = `${this.aiServiceUrl}/api/v1/companion/generate-title`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Niva-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify({ userMessage }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.title && typeof data.title === 'string' && data.title.trim().length > 0) {
          return data.title.trim();
        }
      }
    } catch (err: any) {
      this.logger.debug(`AI title generation skipped or failed: ${err.message}. Using fallback.`);
    }

    return fallbackTitle;
  }
}


