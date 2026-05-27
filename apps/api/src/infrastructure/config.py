from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: Literal["development", "staging", "production"] = "development"
    app_secret_key: str = Field(min_length=32)
    app_cors_origins: list[str] = Field(default=["http://localhost:3000"])

    # Database
    database_url: str
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # AI / Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "qwen2.5:14b"
    ollama_embedding_model: str = "nomic-embed-text"
    agent_max_iterations: int = 15
    agent_timeout_seconds: int = 300

    # Storage
    storage_path: str = "./data"
    storage_max_upload_mb: int = 500
    storage_allowed_extensions: list[str] = Field(
        default=["csv", "parquet", "json", "jsonl"]
    )

    # ML
    ml_model_cache_path: str = "./models"
    ml_inference_timeout: int = 120

    # Vector
    vector_embedding_dim: int = 768

    # Observability
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"
    sentry_dsn: str | None = None

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def storage_max_bytes(self) -> int:
        return self.storage_max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
