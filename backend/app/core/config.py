from pydantic_settings import BaseSettings
from typing import List
import json
import base64
import os


def decrypt_api_key(encrypted_key: str, key: str) -> str:
    if not encrypted_key or not key:
        return ""
    actual_key = encrypted_key[4:] if encrypted_key.startswith("ENC:") else encrypted_key
    try:
        decoded = base64.b64decode(actual_key)
        key_bytes = key.encode()[:32]
        decrypted = []
        for i in range(len(decoded)):
            decrypted.append(chr(decoded[i] ^ key_bytes[i % len(key_bytes)]))
        return "".join(decrypted)
    except Exception:
        return encrypted_key


def encrypt_api_key(api_key: str, key: str) -> str:
    if not api_key or not key:
        return ""
    key_bytes = key.encode()[:32]
    encrypted = []
    for i, char in enumerate(api_key.encode()):
        encrypted.append(char ^ key_bytes[i % len(key_bytes)])
    return "ENC:" + base64.b64encode(bytes(encrypted)).decode()


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
    AZURE_DEVOPS_PAT: str = ""
    JIRA_BASE_URL: str = ""
    JIRA_EMAIL: str = ""
    JIRA_API_TOKEN: str = ""
    
    ENCRYPTION_KEY: str = "bug-triage-app-key"

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)
    
    @property
    def groq_api_key_decrypted(self) -> str:
        return decrypt_api_key(self.GROQ_API_KEY, self.ENCRYPTION_KEY)

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
