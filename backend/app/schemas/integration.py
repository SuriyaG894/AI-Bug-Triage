from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class IntegrationBase(BaseModel):
    tool_type: str = Field(..., pattern="^(azure_devops|jira)$")
    name: Optional[str] = None
    auth_type: str = Field(..., pattern="^(oauth|token)$")


class IntegrationCreate(IntegrationBase):
    credentials: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class IntegrationResponse(IntegrationBase):
    id: int
    is_active: bool
    last_sync_at: Optional[datetime]
    created_at: datetime

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
