"""Application configuration via Pydantic Settings.

Reads from environment variables (or a .env file in development).
Cloud Run injects these as env vars; locally you use a .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://postgres:dev@localhost:5432/infinity"

    # App
    app_title: str = "Infinity Data Explorer API"
    app_version: str = "0.1.0"
    debug: bool = False

    # CORS — origins allowed to call the API
    # In production this will be the Cloud Run URL; in dev, the Vite dev server
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]

    # Data directory (where the JSON files live, relative to project root)
    data_dir: str = "../data"


settings = Settings()
