from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_email: Optional[str]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[int]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    total: int
    logs: List[AuditLogResponse]
    page: int
    page_size: int
