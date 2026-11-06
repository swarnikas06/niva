import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.core.config import Settings, get_settings
from app.core.provider import GeminiProvider

router = APIRouter(prefix="/health", tags=["Health"])
START_TIME = time.time()


class ComponentStatus(BaseModel):
    status: str
    message: Optional[str] = None
    configured: bool


class HealthResponse(BaseModel):
    service: str = "niva-ai"
    status: str
    version: str = "0.1.0"
    timestamp: str
    uptime_seconds: int
    environment: str


class ReadinessResponse(HealthResponse):
    ready: bool
    components: Dict[str, Any]


@router.get("", response_model=HealthResponse)
@router.get("/live", response_model=HealthResponse)
async def get_liveness(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Liveness probe: verifies that the AI FastAPI service is alive."""
    return HealthResponse(
        service="niva-ai",
        status="healthy",
        version="0.1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=int(time.time() - START_TIME),
        environment=settings.environment,
    )


@router.get("/ready", response_model=ReadinessResponse)
async def get_readiness(settings: Settings = Depends(get_settings)) -> ReadinessResponse:
    """Readiness probe: verifies service configuration status."""
    gemini_provider = GeminiProvider(api_key=settings.gemini_api_key)
    provider_configured = gemini_provider.is_configured()

    components = {
        "ai_provider": {
            "name": "gemini",
            "status": "healthy" if provider_configured else "not_configured",
            "configured": provider_configured,
            "message": (
                "Gemini API key is configured"
                if provider_configured
                else "GEMINI_API_KEY environment variable is not set (optional in Phase 0)"
            ),
        }
    }

    return ReadinessResponse(
        service="niva-ai",
        status="healthy",
        ready=True,
        version="0.1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=int(time.time() - START_TIME),
        environment=settings.environment,
        components=components,
    )
