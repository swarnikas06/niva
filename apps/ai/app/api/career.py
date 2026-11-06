import uuid
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status

from app.core.config import get_settings
from app.core.provider import (
    get_ai_provider,
    InterviewQuestionRequest,
    InterviewQuestionResponse,
    InterviewAnswerEvaluationRequest,
    InterviewAnswerEvaluationResponse,
)

logger = logging.getLogger("niva-ai.career")

router = APIRouter(prefix="/career", tags=["Career & Mock Evaluations"])


@router.post(
    "/generate-question",
    response_model=InterviewQuestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate context-grounded mock interview question",
)
async def generate_interview_question(
    payload: InterviewQuestionRequest,
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
):
    settings = get_settings()
    request_id = payload.request_id or str(uuid.uuid4())
    payload.request_id = request_id

    # Internal service secret verification (soft in development, strict in prod)
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
        response = await provider.generate_interview_question(payload)
        logger.info(
            f"[{request_id}] Generated interview question on '{response.targeted_skill}' "
            f"({response.difficulty}) via {response.provider} in {response.latency_ms}ms"
        )
        return response
    except TimeoutError:
        logger.error(f"[{request_id}] Question generation timed out after {settings.ai_timeout_seconds}s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI Provider request timed out during question generation",
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[{request_id}] Question generation error: {err_msg}")
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI Provider rate limit or quota exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error during question generation: {err_msg}",
        )


@router.post(
    "/evaluate-answer",
    response_model=InterviewAnswerEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate candidate mock interview answer across structured dimensions",
)
async def evaluate_interview_answer(
    payload: InterviewAnswerEvaluationRequest,
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
        response = await provider.evaluate_interview_answer(payload)
        logger.info(
            f"[{request_id}] Evaluated candidate answer -> overallRating='{response.overall_rating}' "
            f"via {response.provider} in {response.latency_ms}ms"
        )
        return response
    except TimeoutError:
        logger.error(f"[{request_id}] Answer evaluation timed out after {settings.ai_timeout_seconds}s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI Provider request timed out during answer evaluation",
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[{request_id}] Answer evaluation error: {err_msg}")
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI Provider rate limit or quota exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error during answer evaluation: {err_msg}",
        )
