"""
app/config.py
Application configuration via pydantic-settings.
All values are read from environment variables or the .env file.
"""

from __future__ import annotations

from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central settings object.  Values are loaded from (in order of precedence):
      1. Environment variables
      2. .env file in the project root
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # PostgreSQL
    # ------------------------------------------------------------------
    POSTGRES_USER: str = Field(..., description="PostgreSQL username")
    POSTGRES_PASSWORD: str = Field(..., description="PostgreSQL password")
    POSTGRES_DB: str = Field(..., description="PostgreSQL database name")
    POSTGRES_HOST: str = Field(default="localhost", description="PostgreSQL host")
    POSTGRES_PORT: int = Field(default=5432, description="PostgreSQL port")

    # ------------------------------------------------------------------
    # Shodan
    # ------------------------------------------------------------------
    SHODAN_API_KEY: str = Field(..., description="Shodan API key")

    # ------------------------------------------------------------------
    # Anthropic (Claude) — used by the NL→SQL search endpoint
    # ------------------------------------------------------------------
    ANTHROPIC_API_KEY: str = Field(..., description="Anthropic API key for Claude NL2SQL")

    # ------------------------------------------------------------------
    # Dashboard API key — required on every request via X-API-Key header
    # ------------------------------------------------------------------
    DASHBOARD_API_KEY: str = Field(..., description="Shared secret for dashboard API access")

    # ------------------------------------------------------------------
    # API server
    # ------------------------------------------------------------------
    API_HOST: str = Field(default="0.0.0.0", description="Uvicorn bind host")
    API_PORT: int = Field(default=8000, description="Uvicorn bind port")

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Allowed CORS origins (JSON list string or real list)",
    )

    # ------------------------------------------------------------------
    # PgAdmin (optional — used by docker-compose admin profile)
    # ------------------------------------------------------------------
    PGADMIN_DEFAULT_EMAIL: str = Field(
        default="admin@admin.com",
        description="pgAdmin default login email",
    )
    PGADMIN_DEFAULT_PASSWORD: str = Field(
        default="admin",
        description="pgAdmin default login password",
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> List[str]:
        """
        Accept either:
          - A Python list (already parsed by pydantic)
          - A JSON-encoded string: '["http://localhost:3000"]'
          - A comma-separated string: 'http://localhost:3000,http://localhost:5173'
        """
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                import json
                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        raise ValueError(f"Cannot parse CORS_ORIGINS from {value!r}")

    @field_validator("POSTGRES_PORT", "API_PORT", mode="before")
    @classmethod
    def coerce_port(cls, value: object) -> int:
        return int(value)

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    @property
    def postgres_dsn(self) -> str:
        """Full asyncpg-compatible DSN string."""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import this everywhere
# ---------------------------------------------------------------------------
settings = Settings()  # type: ignore[call-arg]
