from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Bug Triage & Root Cause Analyzer"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/bug_triage"
    )

    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    GROQ_API_KEY: str = ""

    CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:3000"]'

    AZURE_DEVOPS_ORG: str = ""
    AZURE_DEVOPS_PROJECT: str = ""
    JIRA_BASE_URL: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
