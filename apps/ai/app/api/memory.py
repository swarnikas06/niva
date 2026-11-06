import uuid
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status

from app.core.config import get_settings
from app.core.provider import (
    get_ai_provider,
    MemoryExtractionRequest,
    MemoryExtractionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    CandidateEvaluationRequest,
    CandidateEvaluationResponse,
)

logger = logging.getLogger("niva-ai.memory")

router = APIRouter(prefix="/companion", tags=["Companion Memory"])


@router.post(
    "/extract-memories",
    response_model=MemoryExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract structured memory candidates from conversation turn",
)
async def extract_memories(
    payload: MemoryExtractionRequest,
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
):
    settings = get_settings()
    request_id = payload.request_id or str(uuid.uuid4())
    payload.request_id = request_id

    # Internal service secret check (soft in dev, strict in prod)
    if (
        settings.environment == "production"
        and x_niva_internal_secret != settings.internal_service_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal service secret",
        )

    provider = get_ai_provider(settings)

    try:
        response = await provider.extract_memories(payload)
        logger.info(
            f"[{request_id}] Extracted {response.extracted_count} candidates via "
            f"{response.provider} ({response.model}) in {response.latency_ms}ms"
        )
        return response
    except TimeoutError:
        logger.error(f"[{request_id}] Memory extraction timed out after {settings.ai_timeout_seconds}s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI Provider request timed out during memory extraction",
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[{request_id}] Memory extraction error: {err_msg}")
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI Provider rate limit or quota exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error during extraction: {err_msg}",
        )


@router.post(
    "/embed",
    response_model=EmbeddingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate dense 768-dim vector embedding for text",
)
async def generate_embedding(
    payload: EmbeddingRequest,
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
):
    settings = get_settings()
    request_id = payload.request_id or str(uuid.uuid4())
    payload.request_id = request_id

    if (
        settings.environment == "production"
        and x_niva_internal_secret != settings.internal_service_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal service secret",
        )

    provider = get_ai_provider(settings)

    try:
        response = await provider.generate_embedding(payload)

        # Strict dimensionality invariant: MUST match PostgreSQL vector(768)
        if response.dimensions != 768 or len(response.embedding) != 768:
            logger.error(
                f"[{request_id}] Invalid embedding dimension: expected 768, got {response.dimensions}"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Embedding dimension mismatch: expected 768, got {response.dimensions}",
            )

        logger.info(
            f"[{request_id}] Generated 768-dim embedding via {response.provider} "
            f"({response.model}) in {response.latency_ms}ms"
        )
        return response
    except HTTPException:
        raise
    except TimeoutError:
        logger.error(f"[{request_id}] Embedding generation timed out after {settings.ai_timeout_seconds}s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI Provider request timed out during embedding generation",
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[{request_id}] Embedding generation error: {err_msg}")
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI Provider rate limit or quota exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error during embedding: {err_msg}",
        )


@router.post(
    "/evaluate-candidate",
    response_model=CandidateEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate a memory candidate for durability, deduplication, or contradiction",
)
async def evaluate_candidate(
    payload: CandidateEvaluationRequest,
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
):
    settings = get_settings()
    request_id = payload.request_id or str(uuid.uuid4())
    payload.request_id = request_id

    if (
        settings.environment == "production"
        and x_niva_internal_secret != settings.internal_service_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal service secret",
        )

    provider = get_ai_provider(settings)

    try:
        response = await provider.evaluate_candidate(payload)
        logger.info(
            f"[{request_id}] Evaluated candidate {payload.candidate_id} -> "
            f"decision={response.decision} via {response.provider} ({response.model}) in {response.latency_ms}ms"
        )
        return response
    except TimeoutError:
        logger.error(f"[{request_id}] Candidate evaluation timed out after {settings.ai_timeout_seconds}s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI Provider request timed out during candidate evaluation",
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[{request_id}] Candidate evaluation error: {err_msg}")
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI Provider rate limit or quota exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error during candidate evaluation: {err_msg}",
        )

