"""Configuration for the JSON ETL importer.

The runtime API service is now `backend-ts/` and the schema is owned by Drizzle
there. The only Python code that remains is `app/etl/import_json.py`, which
needs a database URL and the data directory.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://postgres:dev@localhost:5432/infinity"
    debug: bool = False
    data_dir: str = "../data"


settings = Settings()
