from typing import Optional
import logging
from fastapi import Header, HTTPException, status
from app.core.config import get_settings

logger = logging.getLogger("niva-ai.security")

INSECURE_DEFAULT_SECRET = "niva_internal_secret_change_in_production_32c"


def verify_internal_secret(
    x_niva_internal_secret: Optional[str] = Header(None, alias="X-Niva-Internal-Secret"),
) -> str:
    """
    Enforces internal service authentication between NestJS API and FastAPI AI service.
    In production:
      - Rejects if NIVA_INTERNAL_SECRET is missing, default, or < 32 characters.
      - Mandates valid X-Niva-Internal-Secret header.
    In development / test:
      - Validates X-Niva-Internal-Secret against configured secret if provided.
      - Blocks unauthorized external callers attempting to invoke AI endpoints.
    """
    settings = get_settings()
    configured_secret = (settings.internal_service_secret or "").strip()

    if settings.environment == "production":
        if (
            not configured_secret
            or configured_secret == INSECURE_DEFAULT_SECRET
            or len(configured_secret) < 32
        ):
            logger.critical("Production error: NIVA_INTERNAL_SECRET is insecure or unset.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: NIVA_INTERNAL_SECRET is insecure or unconfigured",
            )

        if not x_niva_internal_secret or x_niva_internal_secret != configured_secret:
            logger.warning("Unauthorized internal service request rejected in production.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid or missing internal service secret",
            )
    else:
        # Development / testing enforcement
        if configured_secret:
            if x_niva_internal_secret and x_niva_internal_secret != configured_secret:
                logger.warning("Unauthorized internal service request: invalid secret provided.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized: Invalid internal service secret",
                )

    return x_niva_internal_secret or ""
