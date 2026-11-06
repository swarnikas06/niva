from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import get_settings
from app.core.security import verify_internal_secret, INSECURE_DEFAULT_SECRET
from app.api.health import router as health_router
from app.api.generation import router as generation_router
from app.api.memory import router as memory_router
from app.api.career import router as career_router

settings = get_settings()
is_prod = settings.environment == "production"

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("niva-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Fails fast on boot if production secrets or keys are insecure or unconfigured."""
    if is_prod:
        secret = (settings.internal_service_secret or "").strip()
        if not secret or secret == INSECURE_DEFAULT_SECRET or len(secret) < 32:
            logger.critical("[FATAL CONFIGURATION] NIVA_INTERNAL_SECRET is insecure in production.")
            raise RuntimeError(
                "[FATAL SECURITY CONFIGURATION] NIVA_INTERNAL_SECRET must be configured with a "
                "cryptographically secure string (min 32 chars) in production. Unsafe default rejected."
            )
        if not settings.gemini_api_key or len(settings.gemini_api_key.strip()) < 10:
            logger.critical("[FATAL CONFIGURATION] GEMINI_API_KEY is not configured in production.")
            raise RuntimeError(
                "[FATAL SECURITY CONFIGURATION] GEMINI_API_KEY must be configured in production."
            )
    logger.info(f"NIVA AI Service initialized (env: {settings.environment}, model: {settings.ai_model_name})")
    yield


app = FastAPI(
    title="NIVA AI Service",
    description="NIVA AI Intelligence & Provider Gateway",
    version="0.1.0",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware: Strictly allow internal backend callers only.
# Frontend browsers must NEVER talk directly to the AI service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Health routes are accessible for orchestrator liveness / readiness probes
app.include_router(health_router)
app.include_router(health_router, prefix="/api/v1")

# Domain AI generation and memory routes strictly require internal service secret
app.include_router(
    generation_router,
    prefix="/api/v1",
    dependencies=[Depends(verify_internal_secret)],
)
app.include_router(
    memory_router,
    prefix="/api/v1",
    dependencies=[Depends(verify_internal_secret)],
)
app.include_router(
    career_router,
    prefix="/api/v1",
    dependencies=[Depends(verify_internal_secret)],
)


@app.get("/")
async def root():
    return {
        "service": "niva-ai",
        "status": "operational",
        "version": "0.1.0",
        "docs": None if is_prod else "/docs",
    }
