from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class IntegrationBase(BaseModel):
    tool_type: str = Field(..., pattern="^(azure_devops|jira)$")
    name: Optional[str] = None
    auth_type: str = Field(..., pattern="^(oauth|token)$")


class IntegrationCreate(IntegrationBase):
    credentials: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    org: Optional[str] = None
    project: Optional[str] = None


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None
    org: Optional[str] = None
    project: Optional[str] = None


class IntegrationResponse(IntegrationBase):
    id: int
    is_active: bool
    last_sync_at: Optional[datetime]
    created_at: datetime
    org: Optional[str] = None
    project: Optional[str] = None

    class Config:
        from_attributes = True


class IntegrationStatusResponse(BaseModel):
    id: int
    tool_type: str
    name: Optional[str]
    is_active: bool
    is_connected: bool
    last_sync_at: Optional[datetime]
    error_message: Optional[str] = None


class PushBugRequest(BaseModel):
    tool_type: str = Field(..., pattern="^(azure_devops|jira)$")
    project_key: Optional[str] = None


class PushBugResponse(BaseModel):
    success: bool
    external_id: Optional[str] = None
    url: Optional[str] = None
    message: str
    error: Optional[str] = None
    attachment_errors: Optional[List[str]] = None


class ExternalDuplicateCheckRequest(BaseModel):
    description: str = Field(..., min_length=10)
    tool_type: str = Field(..., pattern="^(azure_devops|jira)$")
    project_key: Optional[str] = None


class ExternalSimilarBug(BaseModel):
    id: str
    title: str
    description: str
    similarity: float


class ExternalDuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    similar_bugs: List[ExternalSimilarBug]
    message: str
