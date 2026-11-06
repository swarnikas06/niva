import uuid
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.provider import get_ai_provider, TextGenerationRequest, TokenUsage
from app.core.prompt_synthesizer import PromptSynthesizer

logger = logging.getLogger("niva-ai.generation")

router = APIRouter(prefix="/companion", tags=["Companion Generation"])


class GenerateCompanionReplyRequest(BaseModel):
    """Payload sent by NestJS API to generate a context-driven companion response."""
    conversationId: str
    userMessage: str = Field(..., min_length=1, max_length=8000)
    contextFrame: Dict[str, Any]
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    maxOutputTokens: int = Field(default=2048, ge=1, le=8192)
    requestId: Optional[str] = None


class CompanionAiResponse(BaseModel):
    """Standardized structured response returned to NestJS."""
    content: str
    provider: str
    model: str
    usage: TokenUsage
    latencyMs: float
    requestId: str
    finishReason: Optional[str] = None


@router.post(
    "/generate-reply",
    response_model=CompanionAiResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate context-grounded companion reply",
)
async def generate_reply(
    payload: GenerateCompanionReplyRequest,
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
):
    settings = get_settings()
    request_id = payload.requestId or str(uuid.uuid4())

    # Optional internal service token verification (soft in development, strict in prod)
    if (
        settings.environment == "production"
        and x_niva_internal_secret != settings.internal_service_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal service secret",
        )

    # 1. Synthesize Prompt & History from ContextFrame
    try:
        system_instruction, history_messages = PromptSynthesizer.synthesize(
            context_frame=payload.contextFrame,
            user_message=payload.userMessage,
        )
    except Exception as e:
        logger.error(f"[{request_id}] Prompt synthesis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to synthesize prompt from ContextFrame: {str(e)}",
        )

    # 2. Get AI Provider
    provider = get_ai_provider(settings)

    # 3. Build Generation Request
    gen_request = TextGenerationRequest(
        prompt=payload.userMessage,
        system_instruction=system_instruction,
        history=history_messages,
        temperature=payload.temperature,
        max_output_tokens=payload.maxOutputTokens,
        metadata={"conversation_id": payload.conversationId, "request_id": request_id},
    )

    # 4. Execute Generation with Timeout & Error Normalization
    try:
        gen_response = await provider.generate_text(gen_request)
    except TimeoutError:
        logger.error(f"[{request_id}] Provider timed out after {settings.ai_timeout_seconds}s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI Provider request timed out",
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[{request_id}] AI Provider generation failed: {err_msg}")
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI Provider rate limit or quota exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error: {err_msg}",
        )

    # 5. Validate Output
    if not gen_response.content or not gen_response.content.strip():
        logger.error(f"[{request_id}] Provider returned empty content")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI Provider returned empty response",
        )

    return CompanionAiResponse(
        content=gen_response.content.strip(),
        provider=gen_response.provider,
        model=gen_response.model,
        usage=gen_response.usage,
        latencyMs=gen_response.latency_ms,
        requestId=request_id,
        finishReason=gen_response.finish_reason,
    )


class GenerateTitleRequest(BaseModel):
    userMessage: str = Field(..., min_length=1, max_length=8000)
    requestId: Optional[str] = None


class GenerateTitleResponse(BaseModel):
    title: str
    provider: str
    model: str
    latencyMs: float
    requestId: str


@router.post(
    "/generate-title",
    response_model=GenerateTitleResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a concise 2-5 word topic title from initial user message",
)
async def generate_title(
    payload: GenerateTitleRequest,
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
):
    settings = get_settings()
    request_id = payload.requestId or str(uuid.uuid4())

    if (
        settings.environment == "production"
        and x_niva_internal_secret != settings.internal_service_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal service secret",
        )

    provider = get_ai_provider(settings)

    system_instruction = (
        "You are an expert conversation topic title generator for NIVA.\n"
        "Generate a concise, specific topic title between 2 and 5 words representing the user's inquiry, emotional state, or technical topic.\n"
        "Rules:\n"
        "- Exactly 2 to 5 words.\n"
        "- Title Case (e.g. 'Casual Catchup', 'Placement Preparation Strategy', 'Distributed Systems Design', 'Project Milestone Complete').\n"
        "- Do NOT use quotes, brackets, bullet points, or ending punctuation.\n"
        "- For casual greetings (e.g. 'Hey NIVA', 'How are you', 'Good morning', 'Hello'), ALWAYS return 'Casual Catchup' or 'Daily Check-in'.\n"
        "- For emotional venting or exhaustion, use titles like 'Reflections and Wellbeing' or 'Personal Check-in'.\n"
        "- For milestones and completions, use titles like 'Project Milestone Complete' or 'Achievement Update'.\n"
        "- For specific subject inquiries, extract the exact topic (e.g. 'Placement Preparation Strategy', 'Python Practice Reminder').\n"
        "- Never return generic placeholders like 'New Conversation', 'Chat', or 'Dialogue With NIVA'."
    )

    prompt = (
        f"Generate a concise 2-5 word Title Case topic title for this user message.\n"
        f"If the user message is a casual greeting or check-in, return 'Casual Catchup'.\n"
        f"User message: {payload.userMessage}"
    )

    gen_request = TextGenerationRequest(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=0.2,
        max_output_tokens=32,
        metadata={"request_id": request_id, "action": "generate_title"},
    )

    try:
        gen_response = await provider.generate_text(gen_request)
        clean_title = gen_response.content.strip().replace('"', '').replace("'", '').replace("\n", " ").strip()
        words = clean_title.split()
        if len(words) > 6:
            clean_title = " ".join(words[:5])
        elif len(words) == 0:
            clean_title = "General Dialogue"

        return GenerateTitleResponse(
            title=clean_title,
            provider=gen_response.provider,
            model=gen_response.model,
            latencyMs=gen_response.latency_ms,
            requestId=request_id,
        )
    except Exception as e:
        logger.warning(f"[{request_id}] Title generation failed: {e}. Using heuristic fallback.")
        words = [w for w in payload.userMessage.strip().split() if len(w) > 2]
        fallback_title = " ".join(words[:4]).title() if words else "New Conversation"
        return GenerateTitleResponse(
            title=fallback_title,
            provider="heuristic-fallback",
            model="local",
            latencyMs=0.0,
            requestId=request_id,
        )

