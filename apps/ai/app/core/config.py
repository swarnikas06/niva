from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """NIVA AI Service runtime settings."""

    app_name: str = Field(default="niva-ai")
    environment: str = Field(default="development", alias="NODE_ENV")
    port: int = Field(default=8000, alias="AI_PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Gemini & AI Provider Configuration
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    default_ai_provider: str = Field(default="gemini", alias="DEFAULT_AI_PROVIDER")
    ai_model_name: str = Field(default="gemini-3.8-flash", alias="AI_MODEL_NAME")
    ai_embedding_model_name: str = Field(
        default="gemini-embedding-001", alias="AI_EMBEDDING_MODEL_NAME"
    )
    ai_embedding_dimensions: int = Field(
        default=768, alias="AI_EMBEDDING_DIMENSIONS"
    )
    ai_timeout_seconds: float = Field(default=15.0, alias="AI_TIMEOUT_SECONDS")
    force_mock_provider: bool = Field(default=False, alias="FORCE_MOCK_PROVIDER")

    # Shared Internal Secret for Service-to-Service Security
    internal_service_secret: str = Field(
        default="niva_internal_secret_change_in_production_32c",
        alias="NIVA_INTERNAL_SECRET",
    )

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
