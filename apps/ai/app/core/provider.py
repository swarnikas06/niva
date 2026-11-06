import os
import time
import json
import math
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

from app.core.config import Settings, get_settings
from app.core.prompts.memory_extraction import (
    MEMORY_EXTRACTION_SYSTEM_INSTRUCTION,
    MemoryExtractionPromptBuilder,
)
from app.core.prompts.memory_evaluation import (
    MEMORY_EVALUATION_SYSTEM_INSTRUCTION,
    MemoryEvaluationPromptBuilder,
)

logger = logging.getLogger("niva-ai.provider")


# ==============================================================================
# Text Generation Contracts (Phase 2)
# ==============================================================================

class TextGenerationRequest(BaseModel):
    """Standardized input contract for AI text generation."""
    prompt: str
    system_instruction: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_output_tokens: Optional[int] = Field(default=2048, ge=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TokenUsage(BaseModel):
    """Standardized token accounting metrics."""
    input_tokens: Optional[int] = Field(default=None, serialization_alias="inputTokens")
    output_tokens: Optional[int] = Field(default=None, serialization_alias="outputTokens")
    total_tokens: Optional[int] = Field(default=None, serialization_alias="totalTokens")

    model_config = {"populate_by_name": True}


class TextGenerationResponse(BaseModel):
    """Standardized output contract for AI text generation."""
    content: str
    provider: str
    model: str
    usage: TokenUsage = Field(default_factory=TokenUsage)
    latency_ms: float
    finish_reason: Optional[str] = None


# ==============================================================================
# Memory Extraction & Embedding Contracts (Phase 3B)
# ==============================================================================

AllowedCategory = Literal[
    "semantic_fact",
    "user_preference",
    "episodic_event",
    "open_loop",
]

AllowedConfidenceType = Literal["explicit", "inferred"]


class ExtractedCandidate(BaseModel):
    """Individual memory candidate extracted from a conversation turn."""
    category: AllowedCategory
    content: str = Field(..., min_length=3, max_length=1000)
    confidence: float = Field(..., ge=0.0, le=1.0)
    confidence_type: AllowedConfidenceType = Field(..., alias="confidenceType")
    importance: int = Field(default=5, ge=1, le=10)
    rationale: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 3:
            raise ValueError("Candidate content must be at least 3 characters")
        return trimmed


class MemoryExtractionRequest(BaseModel):
    """Input payload for extracting memory candidates from a conversation turn."""
    user_message: str = Field(..., min_length=1, max_length=8000, alias="userMessage")
    conversation_id: str = Field(..., alias="conversationId")
    message_id: Optional[str] = Field(default=None, alias="messageId")
    recent_history: Optional[List[Dict[str, str]]] = Field(default_factory=list, alias="recentHistory")
    character_persona: Optional[Dict[str, str]] = Field(default=None, alias="characterPersona")
    request_id: Optional[str] = Field(default=None, alias="requestId")

    model_config = {"populate_by_name": True}


class MemoryExtractionResponse(BaseModel):
    """Structured output containing extracted memory candidates and execution metrics."""
    candidates: List[ExtractedCandidate]
    provider: str
    model: str
    latency_ms: float = Field(..., alias="latencyMs")
    request_id: str = Field(..., alias="requestId")
    extracted_count: int = Field(..., alias="extractedCount")

    model_config = {"populate_by_name": True}


class EmbeddingRequest(BaseModel):
    """Input contract for vector embedding generation."""
    text: str = Field(..., min_length=1, max_length=8000)
    memory_id: Optional[str] = Field(default=None, alias="memoryId")
    request_id: Optional[str] = Field(default=None, alias="requestId")

    model_config = {"populate_by_name": True}


class EmbeddingResponse(BaseModel):
    """Output contract for vector embedding generation with strict dimensionality."""
    embedding: List[float]
    provider: str
    model: str
    dimensions: int
    latency_ms: float = Field(..., alias="latencyMs")
    request_id: str = Field(..., alias="requestId")

    model_config = {"populate_by_name": True}


# ==============================================================================
# Memory Evaluation Contracts (Phase 3C)
# ==============================================================================

EvaluationDecisionLiteral = Literal["accept", "reject", "supersede", "defer"]


class CandidateEvaluationRequest(BaseModel):
    """Input contract for evaluating a memory candidate against existing memories."""
    candidate_id: str = Field(..., alias="candidateId")
    category: AllowedCategory
    content: str = Field(..., min_length=3, max_length=1000)
    confidence: float = Field(..., ge=0.0, le=1.0)
    confidence_type: AllowedConfidenceType = Field(..., alias="confidenceType")
    existing_memories: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="existingMemories")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    request_id: Optional[str] = Field(default=None, alias="requestId")

    model_config = {"populate_by_name": True}


class CandidateEvaluationResponse(BaseModel):
    """Output contract for memory candidate evaluation decision."""
    candidate_id: str = Field(..., alias="candidateId")
    decision: EvaluationDecisionLiteral
    reason: str = Field(..., min_length=1, max_length=1000)
    confidence: float = Field(..., ge=0.0, le=1.0)
    supersedes_memory_id: Optional[str] = Field(default=None, alias="supersedesMemoryId")
    duplicate_of_memory_id: Optional[str] = Field(default=None, alias="duplicateOfMemoryId")
    provider: str
    model: str
    latency_ms: float = Field(..., alias="latencyMs")
    request_id: str = Field(..., alias="requestId")

    model_config = {"populate_by_name": True}


# ==============================================================================
# Career Placement Strategy & Mock Evaluation Contracts (Phase 6B)
# ==============================================================================

class InterviewQuestionRequest(BaseModel):
    target_role: Dict[str, Any] = Field(..., alias="targetRole")
    skill: Dict[str, Any]
    session_type: str = Field(default="technical", alias="sessionType")
    difficulty: str = Field(default="intermediate")
    question_number: int = Field(default=1, alias="questionNumber")
    total_questions: int = Field(default=3, alias="totalQuestions")
    previous_turns: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="previousTurns")
    relevant_context: Optional[List[str]] = Field(default_factory=list, alias="relevantContext")
    request_id: Optional[str] = Field(default=None, alias="requestId")

    model_config = {"populate_by_name": True}


class InterviewQuestionResponse(BaseModel):
    question_text: str = Field(..., alias="questionText")
    difficulty: str
    targeted_skill: str = Field(..., alias="targetedSkill")
    context_rationale: str = Field(..., alias="contextRationale")
    provider: str
    model: str
    latency_ms: float = Field(..., alias="latencyMs")

    model_config = {"populate_by_name": True}


class InterviewDimensionEvaluation(BaseModel):
    dimension: str
    rating: str
    feedback: str


class InterviewAnswerEvaluationRequest(BaseModel):
    target_role: Dict[str, Any] = Field(..., alias="targetRole")
    skill: Dict[str, Any]
    session_type: str = Field(default="technical", alias="sessionType")
    difficulty: str = Field(default="intermediate")
    question_text: str = Field(..., alias="questionText")
    user_answer: str = Field(..., alias="userAnswer")
    request_id: Optional[str] = Field(default=None, alias="requestId")

    model_config = {"populate_by_name": True}


class InterviewAnswerEvaluationResponse(BaseModel):
    overall_rating: str = Field(..., alias="overallRating")
    dimensions: List[InterviewDimensionEvaluation]
    strengths: List[str]
    gaps: List[str]
    follow_up_needed: bool = Field(default=False, alias="followUpNeeded")
    suggested_next_difficulty: str = Field(..., alias="suggestedNextDifficulty")
    feedback_notes: str = Field(..., alias="feedbackNotes")
    evidence_summary: Optional[str] = Field(default=None, alias="evidenceSummary")
    provider: str
    model: str
    latency_ms: float = Field(..., alias="latencyMs")

    model_config = {"populate_by_name": True}


# ==============================================================================
# Abstract Provider Interface
# ==============================================================================

class AIProvider(ABC):
    """
    Abstract AI Provider Interface.
    Decouples companion reasoning, memory extraction, evaluation, and embeddings from specific vendors.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g., 'gemini', 'mock')."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the provider has valid credentials or runtime capability."""
        pass

    @abstractmethod
    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        """Generate text completion from prompt and parameters."""
        pass

    @abstractmethod
    async def extract_memories(self, request: MemoryExtractionRequest) -> MemoryExtractionResponse:
        """Extract structured memory candidates from conversation turn."""
        pass

    @abstractmethod
    async def generate_embedding(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Generate dense vector embedding for text."""
        pass

    @abstractmethod
    async def evaluate_candidate(self, request: CandidateEvaluationRequest) -> CandidateEvaluationResponse:
        """Evaluate a memory candidate against existing knowledge and durability rules."""
        pass

    @abstractmethod
    async def generate_interview_question(
        self, request: InterviewQuestionRequest
    ) -> InterviewQuestionResponse:
        """Generate structured, context-grounded mock interview question."""
        pass

    @abstractmethod
    async def evaluate_interview_answer(
        self, request: InterviewAnswerEvaluationRequest
    ) -> InterviewAnswerEvaluationResponse:
        """Evaluate interview answer across structured dimensions without raw CoT."""
        pass


# ==============================================================================
# Google Gemini Provider Implementation
# ==============================================================================

class GeminiProvider(AIProvider):
    """
    Google Gemini implementation of the AIProvider interface using the official google-genai SDK.
    Supports text generation, structured JSON memory extraction, evaluation, and 768-dim text embeddings.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: str = "gemini-3.8-flash",
        embedding_model: str = "gemini-embedding-001",
        embedding_dimensions: int = 768,
        timeout_seconds: float = 15.0,
    ):
        self._api_key = (api_key or "").strip()
        self._default_model = default_model
        self._embedding_model = embedding_model
        self._embedding_dimensions = embedding_dimensions
        self._timeout_seconds = timeout_seconds
        self._client = None
        self._model_cooldowns: Dict[str, float] = {}

        if self.is_configured():
            try:
                from google import genai
                self._client = genai.Client(api_key=self._api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Google GenAI client: {e}")

    @property
    def provider_name(self) -> str:
        return "gemini"

    def is_configured(self) -> bool:
        return bool(self._api_key and len(self._api_key.strip()) > 0)

    async def _generate_content_with_retry(
        self,
        contents: Any,
        config: Any,
        preferred_model: Optional[str] = None,
    ) -> Any:
        """
        Executes generate_content with automatic fallback across compatible Gemini models
        if the primary model encounters temporary capacity spikes (503 UNAVAILABLE or 429).
        """
        primary = preferred_model or self._default_model
        candidates = [primary]
        for fb in [
            "gemini-3.1-flash-lite",
            "gemini-3.1-flash-lite-preview",
            "gemini-flash-lite-latest",
            "gemini-3-flash-preview",
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
        ]:
            if fb not in candidates:
                candidates.append(fb)

        now = time.time()
        # Deprioritize models that are currently in cooldown due to transient failures or quota exhaustion
        active_candidates = [m for m in candidates if now >= self._model_cooldowns.get(m, 0.0)]
        cooled_candidates = [m for m in candidates if now < self._model_cooldowns.get(m, 0.0)]
        ordered_candidates = active_candidates + cooled_candidates

        last_err: Optional[Exception] = None
        for model_name in ordered_candidates:
            try:
                response = await self._client.aio.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config,
                )
                return response, model_name
            except Exception as e:
                err_msg = str(e)
                last_err = e
                if any(c in err_msg for c in ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND"]):
                    # Quota exhaustion gets a configurable cooldown (default 300s); transient spikes get 60s
                    default_quota_cooldown = float(os.getenv("AI_QUOTA_COOLDOWN_SECONDS", "300"))
                    cooldown_duration = default_quota_cooldown if any(q in err_msg for q in ["429", "RESOURCE_EXHAUSTED"]) else 60.0
                    logger.warning(
                        f"Model {model_name} transient failure/quota limit ({err_msg[:80]}). Placing on cooldown for {cooldown_duration}s and attempting next fallback..."
                    )
                    self._model_cooldowns[model_name] = time.time() + cooldown_duration
                    continue
                raise e
        if last_err:
            raise last_err
        raise RuntimeError("No candidate models succeeded")

    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        if not self.is_configured() or not self._client:
            raise RuntimeError(
                "GeminiProvider is not configured with a valid GEMINI_API_KEY. "
                "Set GEMINI_API_KEY in environment variables."
            )

        from google.genai import types

        start_time = time.perf_counter()

        contents: List[types.Content] = []
        if request.history:
            for item in request.history:
                role = "user" if item.get("role") == "user" else "model"
                text = item.get("content", "").strip()
                if text:
                    contents.append(
                        types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=text)],
                        )
                    )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=request.prompt)],
            )
        )

        config_kwargs: Dict[str, Any] = {
            "temperature": request.temperature,
            "max_output_tokens": request.max_output_tokens,
        }
        if request.system_instruction:
            config_kwargs["system_instruction"] = request.system_instruction

        config = types.GenerateContentConfig(**config_kwargs)

        try:
            response, resolved_model = await self._generate_content_with_retry(
                contents=contents,
                config=config,
                preferred_model=self._default_model,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000.0
            content = response.text or ""

            input_tokens = None
            output_tokens = None
            total_tokens = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                input_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
                output_tokens = getattr(response.usage_metadata, "candidates_token_count", None)
                total_tokens = getattr(response.usage_metadata, "total_token_count", None)

            finish_reason = None
            if response.candidates and len(response.candidates) > 0:
                first_cand = response.candidates[0]
                if hasattr(first_cand, "finish_reason"):
                    finish_reason = str(first_cand.finish_reason)

            return TextGenerationResponse(
                content=content,
                provider="gemini",
                model=resolved_model,
                usage=TokenUsage(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                ),
                latency_ms=round(latency_ms, 2),
                finish_reason=finish_reason,
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"Gemini generation error after {latency_ms:.1f}ms: {e}")
            raise

    async def extract_memories(self, request: MemoryExtractionRequest) -> MemoryExtractionResponse:
        if not self.is_configured() or not self._client:
            raise RuntimeError(
                "GeminiProvider is not configured with a valid GEMINI_API_KEY. "
                "Set GEMINI_API_KEY in environment variables."
            )

        from google.genai import types

        start_time = time.perf_counter()
        req_id = request.request_id or "gemini-extract"

        prompt_text = MemoryExtractionPromptBuilder.build_prompt(
            user_message=request.user_message,
            recent_history=request.recent_history,
            character_persona=request.character_persona,
        )

        config = types.GenerateContentConfig(
            system_instruction=MEMORY_EXTRACTION_SYSTEM_INSTRUCTION,
            temperature=0.1,
            response_mime_type="application/json",
            max_output_tokens=2048,
        )

        try:
            response, resolved_model = await self._generate_content_with_retry(
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=prompt_text)],
                    )
                ],
                config=config,
                preferred_model=self._default_model,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000.0
            raw_text = (response.text or "[]").strip()

            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```", 1)[1].split("```", 1)[0].strip()

            try:
                raw_data = json.loads(raw_text)
            except json.JSONDecodeError as json_err:
                logger.error(f"[{req_id}] Gemini returned unparseable JSON: {json_err} | Text: {raw_text[:200]}")
                return MemoryExtractionResponse(
                    candidates=[],
                    provider="gemini",
                    model=self._default_model,
                    latency_ms=round(latency_ms, 2),
                    request_id=req_id,
                    extracted_count=0,
                )

            if isinstance(raw_data, dict) and "candidates" in raw_data:
                raw_data = raw_data["candidates"]
            elif not isinstance(raw_data, list):
                raw_data = [raw_data]

            validated_candidates: List[ExtractedCandidate] = []
            for item in raw_data:
                try:
                    cand = ExtractedCandidate.model_validate(item)
                    validated_candidates.append(cand)
                except Exception as val_err:
                    logger.warning(f"[{req_id}] Discarding invalid candidate: {val_err} | Data: {item}")

            return MemoryExtractionResponse(
                candidates=validated_candidates,
                provider="gemini",
                model=self._default_model,
                latency_ms=round(latency_ms, 2),
                request_id=req_id,
                extracted_count=len(validated_candidates),
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"[{req_id}] Gemini memory extraction failed after {latency_ms:.1f}ms: {e}")
            raise

    async def generate_embedding(self, request: EmbeddingRequest) -> EmbeddingResponse:
        if not self.is_configured() or not self._client:
            raise RuntimeError(
                "GeminiProvider is not configured with a valid GEMINI_API_KEY. "
                "Set GEMINI_API_KEY in environment variables."
            )

        from google.genai import types

        start_time = time.perf_counter()
        req_id = request.request_id or "gemini-embed"

        config = types.EmbedContentConfig(
            output_dimensionality=self._embedding_dimensions,
        )

        try:
            response = await self._client.aio.models.embed_content(
                model=self._embedding_model,
                contents=request.text,
                config=config,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000.0

            embedding_vals: List[float] = []
            if hasattr(response, "embeddings") and response.embeddings:
                first_emb = response.embeddings[0]
                if hasattr(first_emb, "values"):
                    embedding_vals = list(first_emb.values)
            elif hasattr(response, "embedding") and response.embedding:
                if hasattr(response.embedding, "values"):
                    embedding_vals = list(response.embedding.values)

            if len(embedding_vals) != self._embedding_dimensions:
                raise ValueError(
                    f"Embedding dimension mismatch: expected {self._embedding_dimensions}, "
                    f"received {len(embedding_vals)}"
                )

            return EmbeddingResponse(
                embedding=embedding_vals,
                provider="gemini",
                model=self._embedding_model,
                dimensions=len(embedding_vals),
                latency_ms=round(latency_ms, 2),
                request_id=req_id,
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"[{req_id}] Gemini embedding failed after {latency_ms:.1f}ms: {e}")
            raise

    async def evaluate_candidate(self, request: CandidateEvaluationRequest) -> CandidateEvaluationResponse:
        if not self.is_configured() or not self._client:
            raise RuntimeError(
                "GeminiProvider is not configured with a valid GEMINI_API_KEY. "
                "Set GEMINI_API_KEY in environment variables."
            )

        from google.genai import types

        start_time = time.perf_counter()
        req_id = request.request_id or "gemini-eval"

        prompt_text = MemoryEvaluationPromptBuilder.build_prompt(
            candidate_id=request.candidate_id,
            category=request.category,
            content=request.content,
            confidence=request.confidence,
            confidence_type=request.confidence_type,
            existing_memories=request.existing_memories,
            context=request.context,
        )

        config = types.GenerateContentConfig(
            system_instruction=MEMORY_EVALUATION_SYSTEM_INSTRUCTION,
            temperature=0.1,
            response_mime_type="application/json",
            max_output_tokens=1024,
        )

        try:
            response, resolved_model = await self._generate_content_with_retry(
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=prompt_text)],
                    )
                ],
                config=config,
                preferred_model=self._default_model,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000.0
            raw_text = (response.text or "{}").strip()

            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```", 1)[1].split("```", 1)[0].strip()

            raw_data = json.loads(raw_text)

            decision = raw_data.get("decision", "defer")
            if decision not in ["accept", "reject", "supersede", "defer"]:
                decision = "defer"

            return CandidateEvaluationResponse(
                candidateId=request.candidate_id,
                decision=decision,
                reason=raw_data.get("reason", "Evaluation performed by Gemini"),
                confidence=float(raw_data.get("confidence", 0.85)),
                supersedesMemoryId=raw_data.get("supersedesMemoryId"),
                duplicateOfMemoryId=raw_data.get("duplicateOfMemoryId"),
                provider="gemini",
                model=self._default_model,
                latencyMs=round(latency_ms, 2),
                requestId=req_id,
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"[{req_id}] Gemini candidate evaluation failed after {latency_ms:.1f}ms: {e}")
            raise

    async def generate_interview_question(
        self, request: InterviewQuestionRequest
    ) -> InterviewQuestionResponse:
        start_time = time.perf_counter()
        req_id = request.request_id or "gemini-interview-q"
        role_title = request.target_role.get("title", "Software Engineer")
        seniority = request.target_role.get("seniorityLevel", "senior")
        skill_name = request.skill.get("name", "Technical Concept")

        prompt = (
            f"You are an expert technical interviewer assessing a candidate for the role: {seniority} {role_title}.\n"
            f"Topic/Skill to evaluate: {skill_name}\n"
            f"Current Target Difficulty: {request.difficulty}\n"
            f"Question {request.question_number} of {request.total_questions}.\n"
        )
        if request.previous_turns:
            prompt += f"Previous turns: {json.dumps(request.previous_turns)}\n"
        if request.relevant_context:
            prompt += f"Candidate background/context: {'; '.join(request.relevant_context)}\n"

        prompt += (
            "Generate a realistic, scenario-based interview question tailored to this role and difficulty.\n"
            "Return JSON matching this schema exactly:\n"
            "{\n"
            '  "questionText": "Clear, grounded interview question without preamble",\n'
            f'  "difficulty": "{request.difficulty}",\n'
            f'  "targetedSkill": "{skill_name}",\n'
            '  "contextRationale": "Why this question tests the required competency"\n'
            "}"
        )

        try:
            client = self._get_client()
            response = await client.aio.models.generate_content(
                model=self._default_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4,
                ),
            )
            raw_text = (response.text or "").strip()
            if "```json" in raw_text:
                raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```", 1)[1].split("```", 1)[0].strip()

            data = json.loads(raw_text)
            latency_ms = (time.perf_counter() - start_time) * 1000.0

            return InterviewQuestionResponse(
                questionText=data.get("questionText", f"Explain the core architectural trade-offs in {skill_name} for a {role_title}."),
                difficulty=data.get("difficulty", request.difficulty),
                targetedSkill=data.get("targetedSkill", skill_name),
                contextRationale=data.get("contextRationale", f"Tests practical application of {skill_name} under {request.difficulty} difficulty."),
                provider="gemini",
                model=self._default_model,
                latencyMs=round(latency_ms, 2),
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"[{req_id}] Gemini interview question generation failed: {e}")
            mock = MockProvider()
            res = await mock.generate_interview_question(request)
            res.provider = "gemini-fallback"
            return res

    async def evaluate_interview_answer(
        self, request: InterviewAnswerEvaluationRequest
    ) -> InterviewAnswerEvaluationResponse:
        start_time = time.perf_counter()
        req_id = request.request_id or "gemini-interview-eval"
        role_title = request.target_role.get("title", "Software Engineer")
        skill_name = request.skill.get("name", "Technical Concept")

        prompt = (
            f"You are a principal technical interviewer evaluating a candidate's answer for: {role_title}.\n"
            f"Target Skill: {skill_name} | Difficulty: {request.difficulty}\n"
            f"Question Asked: {request.question_text}\n"
            f"Candidate Answer: {request.user_answer}\n\n"
            "Evaluate the candidate across 5 dimensions: technical_correctness, reasoning, communication, depth, completeness.\n"
            "Dimension rating must be one of: 'strong', 'adequate', 'developing', 'insufficient'.\n"
            "Overall rating must be one of: 'strong', 'adequate', 'developing', 'insufficient'.\n"
            "Return JSON matching this schema:\n"
            "{\n"
            '  "overallRating": "strong" | "adequate" | "developing" | "insufficient",\n'
            '  "dimensions": [\n'
            '    {"dimension": "technical_correctness", "rating": "...", "feedback": "..."},\n'
            '    {"dimension": "reasoning", "rating": "...", "feedback": "..."},\n'
            '    {"dimension": "communication", "rating": "...", "feedback": "..."},\n'
            '    {"dimension": "depth", "rating": "...", "feedback": "..."},\n'
            '    {"dimension": "completeness", "rating": "...", "feedback": "..."}\n'
            '  ],\n'
            '  "strengths": ["...", "..."],\n'
            '  "gaps": ["...", "..."],\n'
            '  "followUpNeeded": false,\n'
            '  "suggestedNextDifficulty": "foundation" | "intermediate" | "advanced",\n'
            '  "feedbackNotes": "Constructive, direct feedback summary",\n'
            '  "evidenceSummary": "Concise summary of verified skill competency demonstrated"\n'
            "}\n"
            "Do NOT output raw internal reasoning or chain-of-thought."
        )

        try:
            client = self._get_client()
            response = await client.aio.models.generate_content(
                model=self._default_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            raw_text = (response.text or "").strip()
            if "```json" in raw_text:
                raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```", 1)[1].split("```", 1)[0].strip()

            data = json.loads(raw_text)
            latency_ms = (time.perf_counter() - start_time) * 1000.0

            return InterviewAnswerEvaluationResponse(
                overallRating=data.get("overallRating", "adequate"),
                dimensions=data.get("dimensions", []),
                strengths=data.get("strengths", []),
                gaps=data.get("gaps", []),
                followUpNeeded=bool(data.get("followUpNeeded", False)),
                suggestedNextDifficulty=data.get("suggestedNextDifficulty", request.difficulty),
                feedbackNotes=data.get("feedbackNotes", "Answer reviewed."),
                evidenceSummary=data.get("evidenceSummary"),
                provider="gemini",
                model=self._default_model,
                latencyMs=round(latency_ms, 2),
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"[{req_id}] Gemini interview answer evaluation failed: {e}")
            mock = MockProvider()
            res = await mock.evaluate_interview_answer(request)
            res.provider = "gemini-fallback"
            return res


# ==============================================================================
# Deterministic Mock Provider Implementation
# ==============================================================================

class MockProvider(AIProvider):
    """
    Deterministic Mock AI Provider for automated tests, offline development,
    and environments where GEMINI_API_KEY is not configured.
    Produces schema-valid, deterministic outputs without external network calls.
    """

    def __init__(
        self,
        model_name: str = "niva-mock-companion-v1",
        embedding_model: str = "mock-embedding-v1",
    ):
        self._model_name = model_name
        self._embedding_model = embedding_model
        self._embedding_dimensions = 768

    @property
    def provider_name(self) -> str:
        return "mock"

    def is_configured(self) -> bool:
        return True

    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        start_time = time.perf_counter()
        prompt_lower = request.prompt.lower()
        persona_name = "NIVA"
        active_focus = None

        if request.system_instruction:
            if "The Balanced Anchor" in request.system_instruction:
                persona_name = "The Balanced Anchor"
            elif "The Focused Strategist" in request.system_instruction:
                persona_name = "The Focused Strategist"
            elif "The Calm Guide" in request.system_instruction:
                persona_name = "The Calm Guide"
            elif "The Energetic Catalyst" in request.system_instruction:
                persona_name = "The Energetic Catalyst"

            if "Active Goal Focus:" in request.system_instruction:
                focus_line = [
                    line for line in request.system_instruction.split("\n")
                    if "Active Goal Focus:" in line
                ]
                if focus_line:
                    active_focus = focus_line[0].split("Active Goal Focus:")[1].strip()

        retrieved_memories = []
        if request.system_instruction and "=== RETRIEVED DURABLE MEMORIES" in request.system_instruction:
            after_header = request.system_instruction.split("=== RETRIEVED DURABLE MEMORIES")[1]
            body = after_header.split("\n", 1)[1] if "\n" in after_header else after_header
            mem_section = body.split("===")[0]
            for line in mem_section.strip().split("\n"):
                clean = line.strip()
                if clean.startswith("- [") or (clean.startswith("- ") and "None retrieved" not in clean):
                    retrieved_memories.append(clean)

        matching_memory = None
        for mem in retrieved_memories:
            if "]" in mem and "(" in mem:
                core_fact = mem.split("]")[1].split("(")[0].strip()
            else:
                core_fact = mem.lstrip("- ").strip()
            core_words = [w for w in core_fact.lower().split() if len(w) > 3]
            if any(w in prompt_lower for w in core_words) or any(kw in prompt_lower for kw in ["remember", "recall", "know about me", "preference", "memory", "memories"]):
                matching_memory = core_fact
                break

        # Check for Career & Placement Intelligence in system instruction (Phase 6A)
        sys_inst = request.system_instruction or ""
        career_role = None
        career_discrepancy = None
        if "=== CAREER TRAJECTORY & PREPARATION INTELLIGENCE ===" in sys_inst:
            for line in sys_inst.splitlines():
                if line.startswith("Target Role:"):
                    career_role = line.replace("Target Role:", "").strip()
                elif "Discrepancy:" in line:
                    career_discrepancy = line.split("Discrepancy:")[1].strip()

        # Multi-commitment detection (e.g. assignment, certification, AI project, DSA)
        detected_commitments = []
        if any(w in prompt_lower for w in ["assignment", "college", "homework"]):
            detected_commitments.append("Complete college assignment")
        if any(w in prompt_lower for w in ["certification", "cert", "cloud"]):
            detected_commitments.append("Continue cloud certification study")
        if any(w in prompt_lower for w in ["project", "ai project", "railsense", "voiceshield"]):
            detected_commitments.append("Make progress on AI project")
        if any(w in prompt_lower for w in ["dsa", "leetcode", "algorithm"]):
            detected_commitments.append("Practice Python DSA problem")

        checklist_str = "\n".join([f"[ ] {c}" for c in detected_commitments])

        if matching_memory:
            if persona_name == "The Focused Strategist":
                reply = f"Applying your established constraint: {matching_memory}. Let's factor this directly into our execution plan."
            elif persona_name == "The Calm Guide":
                reply = f"I'm keeping in mind that {matching_memory}. We'll make sure our pace respects that completely."
            elif persona_name == "The Energetic Catalyst":
                reply = f"Awesome—keeping your strength in {matching_memory} front and center! Let's leverage that for maximum momentum."
            else:
                reply = f"As {persona_name}, I recall that {matching_memory}. Let's make sure our approach is thoughtfully aligned with that."

        elif len(detected_commitments) >= 2:
            if persona_name == "The Focused Strategist":
                reply = (
                    f"You have {len(detected_commitments)} distinct tracks competing for bandwidth right now. "
                    "To prevent cognitive fragmentation, here is the highest-leverage execution sequence:\n\n"
                    "1. Clear academic obligations first (immediate deadline risk).\n"
                    "2. High-value technical interview skill: 1 targeted DSA problem.\n"
                    "3. Project artifact: deliverable on your AI project.\n"
                    "4. Knowledge expansion: cloud certification concepts.\n\n"
                    f"Candidate checklist:\n{checklist_str}\n\n"
                    "Which of these is the immediate bottleneck today?"
                )
            elif persona_name == "The Calm Guide":
                reply = (
                    f"You have a lot of meaningful ambitions on your plate, but you don't need to carry them all simultaneously. "
                    "Let's break this down into a calm, realistic rhythm:\n\n"
                    "• Take care of the college assignment first so it isn't hanging over you.\n"
                    "• Protect your morning energy for certification learning.\n"
                    "• Keep your AI project and DSA moving with small, consistent steps.\n\n"
                    f"Here is what I've noted:\n{checklist_str}\n\n"
                    "Take your time. Which of these would feel most relieving to tackle first?"
                )
            elif persona_name == "The Energetic Catalyst":
                reply = (
                    f"Incredible drive! Balancing {len(detected_commitments)} great goals is a powerful challenge. "
                    "Let's channel this into rapid, visible progress:\n\n"
                    "1. Blitz the college assignment to clear the decks!\n"
                    "2. Run a 25-minute sprint on a Python DSA problem!\n"
                    "3. Ship the next milestone on your AI project!\n"
                    "4. Review a cloud certification module before wrapping up!\n\n"
                    f"Action checklist:\n{checklist_str}\n\n"
                    "Let's pick one and get started right now!"
                )
            else: # The Balanced Anchor
                reply = (
                    f"I recognize that you're managing multiple competing responsibilities across your coursework, technical learning, and project building. "
                    "Here is a balanced sequence designed to maintain steady progress without burnout:\n\n"
                    "1. Urgent academic commitments: finish the college assignment first.\n"
                    "2. High-leverage practice: consistent morning study for your cloud certification.\n"
                    "3. Practical building: focused sprint time for your AI project.\n"
                    "4. Algorithmic skill: solve one focused DSA problem in Python.\n\n"
                    f"Candidate actions recognized from our conversation:\n{checklist_str}\n\n"
                    "I haven't locked in deadlines since you haven't specified them. Would you like me to track these in your Life plan?"
                )

        elif career_role and any(kw in prompt_lower for kw in ["ready", "readiness", "interview", "role", "career", "gap"]):
            if "OVERCONFIDENT" in (career_discrepancy or "") or "CHALLENGE" in sys_inst:
                reply = (
                    f"Looking directly at your preparation for {career_role}: your stated confidence is high, "
                    f"but our evidence alignment shows critical gaps. You have demonstrated solid strengths, "
                    f"but mandatory requirements lack verified artifacts. "
                    f"Let's focus on bridging those specific evidence gaps before scheduling technical loops."
                )
            else:
                reply = (
                    f"For {career_role}, your technical foundation is progressing. "
                    f"Let's target your highest priority preparation activities."
                )
        elif active_focus and ("focus" in prompt_lower or "goal" in prompt_lower or "next" in prompt_lower):
            if persona_name == "The Focused Strategist":
                reply = f"Locking in on primary focus: '{active_focus}'. Let's eliminate non-essential work and execute the single highest-impact milestone."
            elif persona_name == "The Calm Guide":
                reply = f"Keeping our focus gently centered on '{active_focus}'. Let's take it one step at a time without feeling rushed."
            elif persona_name == "The Energetic Catalyst":
                reply = f"Laser focus on '{active_focus}'! Let's build serious momentum on this right now."
            else:
                reply = f"As {persona_name}, I'm keeping our attention grounded on your primary focus: '{active_focus}'. Let's outline the next realistic step."
        elif any(w in prompt_lower.split() for w in ["hello", "hi", "hey", "heyy"]):
            if persona_name == "The Focused Strategist":
                reply = "Hey. Good to connect. What's the highest priority objective on your plate today?"
            elif persona_name == "The Calm Guide":
                reply = "Hello. Take your time—how has your day been treating you?"
            elif persona_name == "The Energetic Catalyst":
                reply = "Hey there! Ready to jump in and make some real progress today. What are we building?"
            else:
                reply = f"Hello! I'm here with you as {persona_name}. Your active context is loaded and I'm ready whenever you want to dive in."
        elif "test" in prompt_lower or "verify" in prompt_lower:
            reply = (
                f"Cognitive link verified. I am operating as {persona_name} with full awareness of your current commitments and dialogue history."
            )
        else:
            if persona_name == "The Focused Strategist":
                reply = (
                    f"Considering your situation from a strategic angle: the key is to isolate the primary bottleneck, "
                    f"define a measurable outcome, and execute without hesitation. What is the immediate constraint holding this back?"
                )
            elif persona_name == "The Calm Guide":
                reply = (
                    f"I hear what you're sharing. Let's give this some room to breathe before making any rushed moves. "
                    f"What aspect feels most important to untangle first?"
                )
            elif persona_name == "The Energetic Catalyst":
                reply = (
                    f"That's a great opportunity to create momentum! Let's turn that idea into a quick, tangible action step right now."
                )
            else:
                reply = (
                    f"I understand your perspective. Balancing your active responsibilities while moving this forward requires a structured, step-by-step approach. "
                    f"Let's look at the clearest next action we can take today."
                )

        latency_ms = (time.perf_counter() - start_time) * 1000.0 + 35.0
        simulated_input_tokens = len(request.prompt + (request.system_instruction or "")) // 4
        simulated_output_tokens = len(reply) // 4

        return TextGenerationResponse(
            content=reply,
            provider="mock",
            model=self._model_name,
            usage=TokenUsage(
                input_tokens=simulated_input_tokens,
                output_tokens=simulated_output_tokens,
                total_tokens=simulated_input_tokens + simulated_output_tokens,
            ),
            latency_ms=round(latency_ms, 2),
            finish_reason="stop",
        )

    async def extract_memories(self, request: MemoryExtractionRequest) -> MemoryExtractionResponse:
        start_time = time.perf_counter()
        text = request.user_message.strip()
        text_lower = text.lower()
        req_id = request.request_id or "mock-extract"

        candidates: List[ExtractedCandidate] = []

        # Rule 1: No Operational Duplication
        is_operational = any(kw in text_lower for kw in [
            "finish my assignment", "finish the report", "buy groceries", "call the dentist",
            "submit the assignment", "clean my room", "todo:", "to-do", "schedule a meeting",
            "exam tomorrow"
        ])

        # Rule 2: Precision over Recall
        is_transient = any(text_lower == greeting or text_lower.startswith(f"{greeting} ") for greeting in [
            "hello", "hi", "hey", "good morning", "good evening", "good night", "thanks", "thank you",
            "ok", "okay", "bye", "see you", "how are you", "what time is it"
        ])

        if not is_operational and not is_transient:
            # Explicit User Preferences
            if "prefer python" in text_lower or "preference is python" in text_lower or "focus heavily on python" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="user_preference",
                        content="User prefers Python for programming and software development.",
                        confidence=0.95,
                        confidenceType="explicit",
                        importance=7,
                        rationale="Direct statement of programming language preference.",
                    )
                )
            elif "focus on c++" in text_lower or "c++ instead of python" in text_lower or "prefer c++" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="user_preference",
                        content="User decided to focus on C++ instead of Python for projects.",
                        confidence=0.96,
                        confidenceType="explicit",
                        importance=8,
                        rationale="Direct statement updating primary language focus to C++.",
                    )
                )
            elif "likes using python" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="user_preference",
                        content="User likes using Python rather than C++.",
                        confidence=0.92,
                        confidenceType="explicit",
                        importance=7,
                        rationale="Re-stated programming preference.",
                    )
                )
            elif "coffee" in text_lower and ("dark roast" in text_lower or "oat milk" in text_lower):
                candidates.append(
                    ExtractedCandidate(
                        category="user_preference",
                        content="User prefers dark roast coffee with oat milk.",
                        confidence=0.92,
                        confidenceType="explicit",
                        importance=6,
                        rationale="Explicit morning beverage preference.",
                    )
                )
            elif "dislike" in text_lower or "hate" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="user_preference",
                        content=f"User stated a strong negative preference: {text}",
                        confidence=0.90,
                        confidenceType="explicit",
                        importance=6,
                        rationale="Expressed negative preference.",
                    )
                )

            # Inferred behavioral preference
            elif "keep choosing python" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="user_preference",
                        content="User tends to choose Python whenever starting a project.",
                        confidence=0.75,
                        confidenceType="inferred",
                        importance=6,
                        rationale="Inferred recurring behavioral choice.",
                    )
                )

            # Explicit Semantic Facts
            elif "live in tokyo" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="semantic_fact",
                        content="User lives in Tokyo.",
                        confidence=0.96,
                        confidenceType="explicit",
                        importance=8,
                        rationale="Direct biographical statement of residence.",
                    )
                )
            elif "work as" in text_lower or "architect" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="semantic_fact",
                        content="User works as a Distributed Systems Architect.",
                        confidence=0.95,
                        confidenceType="explicit",
                        importance=8,
                        rationale="Direct professional role disclosure.",
                    )
                )

            # Inferred Curiosities / Speculation (Open Loop)
            elif "learn kubernetes" in text_lower or "learning kubernetes" in text_lower or "thinking about learning kubernetes" in text_lower or "might learn" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="open_loop",
                        content="User is considering learning Kubernetes.",
                        confidence=0.70,
                        confidenceType="inferred",
                        importance=5,
                        rationale="Tentative future exploration interest expressed.",
                    )
                )

            # Episodic Events
            elif "graduated" in text_lower or "launched my first" in text_lower or "ran a marathon" in text_lower:
                candidates.append(
                    ExtractedCandidate(
                        category="episodic_event",
                        content=f"User milestone event: {text}",
                        confidence=0.88,
                        confidenceType="explicit",
                        importance=8,
                        rationale="Personal historical milestone shared.",
                    )
                )

        latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0

        return MemoryExtractionResponse(
            candidates=candidates,
            provider="mock",
            model=self._model_name,
            latencyMs=round(latency_ms, 2),
            requestId=req_id,
            extractedCount=len(candidates),
        )

    async def generate_embedding(self, request: EmbeddingRequest) -> EmbeddingResponse:
        start_time = time.perf_counter()
        req_id = request.request_id or "mock-embed"

        text_lower = request.text.lower()
        topic_seeds = [
            ("dark mode", b"topic_dark_mode_theme_preference_cluster"),
            ("theme", b"topic_dark_mode_theme_preference_cluster"),
            ("python", b"topic_python_programming_language_cluster"),
            ("programming", b"topic_python_programming_language_cluster"),
            ("coding", b"topic_python_programming_language_cluster"),
            ("c++", b"topic_cpp_programming_language_cluster"),
            ("tokyo", b"topic_residence_location_cluster"),
            ("london", b"topic_residence_location_cluster"),
            ("kubernetes", b"topic_kubernetes_cloud_native_cluster"),
            ("coffee", b"topic_coffee_beverage_cluster"),
        ]

        matched_cluster = None
        for keyword, cluster_seed in topic_seeds:
            if keyword in text_lower:
                matched_cluster = cluster_seed
                break

        specific_seed = hashlib.sha256(request.text.encode("utf-8")).digest()
        raw_vec: List[float] = []

        if matched_cluster:
            cluster_hash = hashlib.sha256(matched_cluster).digest()
            for i in range(self._embedding_dimensions):
                c_byte = cluster_hash[i % len(cluster_hash)]
                s_byte = specific_seed[i % len(specific_seed)]
                val = 0.88 * math.sin((i + 1) * (c_byte + 1)) + 0.12 * math.sin((i + 1) * (s_byte + 1))
                raw_vec.append(val)
        else:
            for i in range(self._embedding_dimensions):
                byte_val = specific_seed[i % len(specific_seed)]
                val = math.sin((i + 1) * (byte_val + 1))
                raw_vec.append(val)

        norm = math.sqrt(sum(x * x for x in raw_vec)) or 1.0
        normalized_vec = [round(x / norm, 6) for x in raw_vec]

        latency_ms = (time.perf_counter() - start_time) * 1000.0 + 10.0

        return EmbeddingResponse(
            embedding=normalized_vec,
            provider="mock",
            model=self._embedding_model,
            dimensions=self._embedding_dimensions,
            latencyMs=round(latency_ms, 2),
            requestId=req_id,
        )

    async def evaluate_candidate(self, request: CandidateEvaluationRequest) -> CandidateEvaluationResponse:
        start_time = time.perf_counter()
        content = request.content
        content_lower = content.lower()
        req_id = request.request_id or "mock-eval"
        ctx = request.context or {}

        # 1. Force Failure simulation
        if "force_eval_failure" in content_lower or ctx.get("force_failure"):
            raise RuntimeError("Simulated AI Provider evaluation failure during candidate evaluation")

        # 2. Force Malformed simulation
        if "force_malformed_output" in content_lower or ctx.get("force_malformed"):
            return CandidateEvaluationResponse.model_construct(
                candidate_id=request.candidate_id,
                decision="invalid_decision",
                reason="Malformed output test",
                confidence=2.5,
                provider="mock",
                model=self._model_name,
                latency_ms=10.0,
                request_id=req_id,
            )

        # 3. Operational task detection (No operational duplication)
        is_operational = any(kw in content_lower for kw in [
            "exam tomorrow", "buy milk", "submit assignment", "deadline", "todo:", "task", "assignment tomorrow"
        ])
        if is_operational:
            return CandidateEvaluationResponse(
                candidateId=request.candidate_id,
                decision="reject",
                reason="Operational commitment or task belongs in Life Context",
                confidence=0.98,
                provider="mock",
                model=self._model_name,
                latencyMs=15.0,
                requestId=req_id,
            )

        # 4. Transient state detection (Durability vs Transience)
        is_transient = any(kw in content_lower for kw in [
            "tired", "sleepy", "hungry", "headache", "busy today", "busy right now",
            "coffee right now", "having coffee", "feeling a bit tired"
        ])
        if is_transient:
            return CandidateEvaluationResponse(
                candidateId=request.candidate_id,
                decision="reject",
                reason="Transient physical/emotional state with low long-term durability",
                confidence=0.95,
                provider="mock",
                model=self._model_name,
                latencyMs=15.0,
                requestId=req_id,
            )

        # 5. Contradiction & Supersession check against existing memories
        existing_memories = request.existing_memories or []
        for mem in existing_memories:
            mem_content_lower = mem.get("content", "").lower()
            # If candidate is switching/focusing on C++ instead of Python and existing memory prefers Python
            is_contradiction = (
                ("c++" in content_lower and ("instead of python" in content_lower or "switched" in content_lower or "focus" in content_lower))
                and ("python" in mem_content_lower and "prefer" in mem_content_lower)
            ) or (
                ("lives in" in content_lower or "living in" in content_lower)
                and ("lives in" in mem_content_lower or "living in" in mem_content_lower)
                and ("london" in content_lower and "tokyo" in mem_content_lower)
            ) or (
                "contradict" in content_lower
            )
            if is_contradiction:
                latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
                return CandidateEvaluationResponse(
                    candidateId=request.candidate_id,
                    decision="supersede",
                    reason="Candidate directly contradicts and updates prior active memory",
                    confidence=0.96,
                    supersedesMemoryId=mem.get("id"),
                    provider="mock",
                    model=self._model_name,
                    latencyMs=round(latency_ms, 2),
                    requestId=req_id,
                )

        # 6. Duplicate check against existing memories
        for mem in existing_memories:
            mem_content_lower = mem.get("content", "").lower()
            sim = float(mem.get("similarity", 0.0) or 0.0)
            is_dup = (
                sim >= 0.88
                or (
                    ("prefer python" in content_lower or "likes using python" in content_lower or "prefers python" in content_lower)
                    and ("prefer python" in mem_content_lower or "prefers python" in mem_content_lower)
                )
                or (
                    "dark mode" in content_lower and "dark mode" in mem_content_lower
                )
            )
            if is_dup:
                latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
                return CandidateEvaluationResponse(
                    candidateId=request.candidate_id,
                    decision="reject",
                    reason=f"Semantic duplicate of existing active memory {mem.get('id')}",
                    confidence=0.95,
                    duplicateOfMemoryId=mem.get("id"),
                    provider="mock",
                    model=self._model_name,
                    latencyMs=round(latency_ms, 2),
                    requestId=req_id,
                )

        # 7. Deferral check
        if "defer" in content_lower or "might perhaps" in content_lower:
            latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
            return CandidateEvaluationResponse(
                candidateId=request.candidate_id,
                decision="defer",
                reason="Insufficient conversational evidence to determine durability",
                confidence=0.55,
                provider="mock",
                model=self._model_name,
                latencyMs=round(latency_ms, 2),
                requestId=req_id,
            )

        # 8. Open loop curiosity check
        if request.category == "open_loop" or "kubernetes" in content_lower:
            latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
            return CandidateEvaluationResponse(
                candidateId=request.candidate_id,
                decision="accept",
                reason="Valid intellectual open loop curiosity to track as durable memory",
                confidence=0.90,
                provider="mock",
                model=self._model_name,
                latencyMs=round(latency_ms, 2),
                requestId=req_id,
            )

        # 9. Inferred info check
        if request.confidence_type == "inferred":
            latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
            return CandidateEvaluationResponse(
                candidateId=request.candidate_id,
                decision="accept",
                reason="Inferred behavioral pattern accepted with epistemic qualification",
                confidence=request.confidence,
                provider="mock",
                model=self._model_name,
                latencyMs=round(latency_ms, 2),
                requestId=req_id,
            )

        # 10. Default acceptance for durable facts/preferences
        latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
        return CandidateEvaluationResponse(
            candidateId=request.candidate_id,
            decision="accept",
            reason="High durability explicit personal preference or fact",
            confidence=request.confidence,
            provider="mock",
            model=self._model_name,
            latencyMs=round(latency_ms, 2),
            requestId=req_id,
        )

    async def generate_interview_question(
        self, request: InterviewQuestionRequest
    ) -> InterviewQuestionResponse:
        start_time = time.perf_counter()
        role_title = request.target_role.get("title", "Distributed Systems Engineer")
        skill_name = request.skill.get("name", "Core Technical")
        difficulty = request.difficulty.lower()
        context_items = request.relevant_context or []

        # Determine scenario based on skill name and difficulty
        skill_lower = skill_name.lower()
        if "python" in skill_lower:
            if difficulty == "foundation":
                q_text = "Can you explain how Python's GIL affects CPU-bound vs I/O-bound concurrency, and what standard approaches you use to achieve true parallel execution?"
                rationale = "Tests foundational concurrency mechanics and interpreter design understanding."
            elif difficulty == "advanced":
                q_text = "How does Python's memory allocator (PyMalloc) manage small object arenas, and what strategies would you deploy to profile and mitigate fragmentation in long-running services?"
                rationale = "Tests advanced memory management, GC internal mechanics, and production profiling."
            else:
                q_text = "In Python, how would you design an asynchronous worker pool handling bursty HTTP workloads using asyncio while preventing unhandled task exceptions and event loop starvation?"
                rationale = "Tests intermediate asynchronous programming patterns and failure isolation."
        elif any(k in skill_lower for k in ["dsa", "algorithm", "data structure"]):
            if difficulty == "foundation":
                q_text = "Explain the internal structure and collision resolution trade-offs of hash tables (open addressing vs separate chaining), including worst-case versus amortized time complexity."
                rationale = "Tests foundational algorithmic complexity and memory layouts."
            elif difficulty == "advanced":
                q_text = "Describe an algorithm to find strongly connected components in a directed cyclic graph (e.g. Tarjan's). How would you optimize the stack traversal for cache locality on very large graphs?"
                rationale = "Tests advanced graph traversal algorithms and cache-aware memory patterns."
            else:
                q_text = "Given a continuous data stream of transactions, how would you maintain the 99th percentile latency in bounded memory and sub-millisecond query time?"
                rationale = "Tests streaming quantile estimators (e.g. t-digest or HdrHistogram) and trade-offs."
        elif any(k in skill_lower for k in ["system design", "architecture", "distributed"]):
            if difficulty == "foundation":
                q_text = "Explain the fundamental trade-offs between horizontal vs vertical scaling, and how consistent hashing minimizes cache invalidation during rebalancing."
                rationale = "Tests foundational distributed architectural trade-offs."
            elif difficulty == "advanced":
                q_text = "Design a globally distributed leaderless replication store under the CAP theorem. How would you reconcile conflicting concurrent writes using vector clocks while minimizing tail read latency?"
                rationale = "Tests advanced distributed consistency, conflict resolution, and quorum dynamics."
            else:
                q_text = "For a high-throughput event processing pipeline, walk through how consumer group partition rebalances work in Kafka/Pulsar and how you prevent partition hot-spotting."
                rationale = "Tests streaming partition management, backpressure, and consumer scaling."
        else:
            if difficulty == "foundation":
                q_text = f"In {role_title}, what core design principles and operational conventions do you adhere to when implementing {skill_name}?"
                rationale = f"Evaluates foundational competency in {skill_name}."
            elif difficulty == "advanced":
                q_text = f"Under extreme scale and tight SLA constraints, what non-obvious failure modes have you encountered in {skill_name}, and how did you architect resilience against them?"
                rationale = f"Tests battle-tested architectural depth and resilience engineering in {skill_name}."
            else:
                q_text = f"Describe a production scenario where you had to debug a subtle latency degradation or reliability issue involving {skill_name} in a {role_title} capacity. What trade-offs guided your fix?"
                rationale = f"Evaluates practical problem solving and trade-off evaluation in {skill_name}."

        # If previous turns or context existed, prepend contextual bridge
        if context_items:
            q_text = f"Considering your background with {context_items[0]}: {q_text}"

        latency_ms = (time.perf_counter() - start_time) * 1000.0 + 12.0
        return InterviewQuestionResponse(
            questionText=q_text,
            difficulty=request.difficulty,
            targetedSkill=skill_name,
            contextRationale=rationale,
            provider="mock",
            model=self._model_name,
            latencyMs=round(latency_ms, 2),
        )

    async def evaluate_interview_answer(
        self, request: InterviewAnswerEvaluationRequest
    ) -> InterviewAnswerEvaluationResponse:
        start_time = time.perf_counter()
        skill_name = request.skill.get("name", "Technical Concept")
        role_title = request.target_role.get("title", "Software Engineer")
        answer_text = (request.user_answer or "").strip()
        answer_lower = answer_text.lower()

        # 1. Very short or empty answer -> Insufficient
        if len(answer_text) < 30 or any(answer_lower == phrase for phrase in ["idk", "i don't know", "not sure", "pass"]):
            latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
            return InterviewAnswerEvaluationResponse(
                overallRating="insufficient",
                dimensions=[
                    InterviewDimensionEvaluation(dimension="technical_correctness", rating="insufficient", feedback="Answer provides insufficient technical content to evaluate correctness."),
                    InterviewDimensionEvaluation(dimension="reasoning", rating="insufficient", feedback="No technical reasoning or trade-offs demonstrated."),
                    InterviewDimensionEvaluation(dimension="communication", rating="developing", feedback="Needs to articulate a complete, structured answer."),
                    InterviewDimensionEvaluation(dimension="depth", rating="insufficient", feedback="No architectural or implementation depth present."),
                    InterviewDimensionEvaluation(dimension="completeness", rating="insufficient", feedback="Did not address the question."),
                ],
                strengths=[],
                gaps=["Answer was too brief to demonstrate competence", f"Missing core technical concepts for {skill_name}"],
                followUpNeeded=True,
                suggestedNextDifficulty="foundation",
                feedbackNotes=f"Your answer was too brief to demonstrate readiness for {role_title}. Aim to articulate the core mechanisms, trade-offs, and examples.",
                evidenceSummary=None,
                provider="mock",
                model=self._model_name,
                latencyMs=round(latency_ms, 2),
            )

        # 2. Rich, detailed technical answer -> Strong
        tech_keywords = [
            "tradeoff", "trade-off", "latency", "throughput", "concurrency", "consistent",
            "partition", "memory", "cache", "async", "lock", "queue", "complexity",
            "invariant", "benchmark", "resilience", "backpressure", "profiling"
        ]
        keyword_hits = sum(1 for kw in tech_keywords if kw in answer_lower)

        if len(answer_text) > 120 and keyword_hits >= 2:
            latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
            return InterviewAnswerEvaluationResponse(
                overallRating="strong",
                dimensions=[
                    InterviewDimensionEvaluation(dimension="technical_correctness", rating="strong", feedback=f"Accurately explains the underlying mechanics of {skill_name}."),
                    InterviewDimensionEvaluation(dimension="reasoning", rating="strong", feedback="Articulates clear trade-offs between performance and operational simplicity."),
                    InterviewDimensionEvaluation(dimension="communication", rating="strong", feedback="Structured, precise explanation with appropriate technical terminology."),
                    InterviewDimensionEvaluation(dimension="depth", rating="strong", feedback="Demonstrates production-level intuition and failure scenario awareness."),
                    InterviewDimensionEvaluation(dimension="completeness", rating="strong", feedback="Comprehensive coverage addressing the scenario thoroughly."),
                ],
                strengths=[
                    f"Strong conceptual command of {skill_name}",
                    "Proactive trade-off analysis balancing latency and complexity",
                    "Clear articulation of failure modes and mitigations",
                ],
                gaps=[
                    "Could further quantify specific memory or CPU benchmarks under peak load",
                ],
                followUpNeeded=False,
                suggestedNextDifficulty="advanced" if request.difficulty != "advanced" else "advanced",
                feedbackNotes=f"Excellent technical depth and clarity. You clearly articulated the core invariants and practical trade-offs for {role_title}.",
                evidenceSummary=f"Demonstrated advanced command of {skill_name} principles, trade-offs, and failure mode mitigations in mock evaluation.",
                provider="mock",
                model=self._model_name,
                latencyMs=round(latency_ms, 2),
            )

        # 3. Moderate answer -> Adequate or Developing
        is_developing = len(answer_text) < 70 or keyword_hits == 0
        overall_rating = "developing" if is_developing else "adequate"
        next_diff = "foundation" if is_developing else "intermediate"

        latency_ms = (time.perf_counter() - start_time) * 1000.0 + 15.0
        return InterviewAnswerEvaluationResponse(
            overallRating=overall_rating,
            dimensions=[
                InterviewDimensionEvaluation(dimension="technical_correctness", rating=overall_rating, feedback=f"Demonstrates basic familiarity with {skill_name}."),
                InterviewDimensionEvaluation(dimension="reasoning", rating=overall_rating, feedback="Identifies general direction but lacks explicit trade-off justification."),
                InterviewDimensionEvaluation(dimension="communication", rating="adequate", feedback="Coherent explanation that could be more crisp and specific."),
                InterviewDimensionEvaluation(dimension="depth", rating=overall_rating, feedback="Covers surface-level concepts; could probe deeper into failure states."),
                InterviewDimensionEvaluation(dimension="completeness", rating=overall_rating, feedback="Addresses the main prompt question satisfactorily."),
            ],
            strengths=[
                f"Basic familiarity with {skill_name} concepts",
                "Reasonable approach to problem framing",
            ],
            gaps=[
                "Did not explore performance bottlenecks or edge-case failure modes",
                f"Needs to ground reasoning in tangible architectural trade-offs for a {role_title}",
            ],
            followUpNeeded=is_developing,
            suggestedNextDifficulty=next_diff,
            feedbackNotes=f"Solid foundational answer. To elevate your response for a {role_title} bar, dive deeper into specific trade-offs and edge-case behavior.",
            evidenceSummary=f"Demonstrated working knowledge of {skill_name} under mock evaluation." if not is_developing else None,
            provider="mock",
            model=self._model_name,
            latencyMs=round(latency_ms, 2),
        )


# ==============================================================================
# Factory Function
# ==============================================================================

def get_ai_provider(settings: Optional[Settings] = None) -> AIProvider:
    """
    Factory to retrieve the active AI provider based on configuration.
    """
    s = settings or get_settings()

    if s.force_mock_provider:
        logger.info("Using MockProvider (forced via FORCE_MOCK_PROVIDER=True)")
        return MockProvider()

    if s.default_ai_provider == "gemini" and s.gemini_api_key.strip():
        logger.info(
            f"Using GeminiProvider with model '{s.ai_model_name}' "
            f"and embedding model '{s.ai_embedding_model_name}'"
        )
        return GeminiProvider(
            api_key=s.gemini_api_key,
            default_model=s.ai_model_name,
            embedding_model=s.ai_embedding_model_name,
            embedding_dimensions=s.ai_embedding_dimensions,
            timeout_seconds=s.ai_timeout_seconds,
        )

    logger.warning("GEMINI_API_KEY is not configured. Falling back to deterministic MockProvider.")
    return MockProvider()
