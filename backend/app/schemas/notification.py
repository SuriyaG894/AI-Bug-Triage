from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    metadata_: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    notifications: List[NotificationResponse]


class UnreadCountResponse(BaseModel):
    count: int


class NotificationSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
