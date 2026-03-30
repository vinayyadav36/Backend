# apps/ml-agent-fastapi/core/config.py
import os
from dataclasses import dataclass


@dataclass
class Settings:
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name: str = os.getenv("DB_NAME", "jarvis")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    temporal_address: str = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    otlp_endpoint: str = os.getenv("OTLP_ENDPOINT", "http://otel-collector:4318/v1/traces")


settings = Settings()
