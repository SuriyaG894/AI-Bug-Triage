from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.core.database import get_db, User, Notification
from app.schemas import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
    NotificationSettingsUpdate,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
security = HTTPBearer(auto_error=False)


async def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    from app.api.routes.auth import decode_token

    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_filter = [Notification.user_id == current_user.id]
    if unread_only:
        base_filter.append(Notification.is_read == False)

    total_q = select(func.count()).where(*base_filter)
    total = await db.scalar(total_q)

    unread_q = select(func.count()).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    unread_count = await db.scalar(unread_q)

    query = (
        select(Notification)
        .where(*base_filter)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    return NotificationListResponse(
        total=total or 0,
        unread_count=unread_count or 0,
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(func.count()).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    count = await db.scalar(q)
    return UnreadCountResponse(count=count or 0)


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: int,
    current_user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    await db.commit()
    await db.refresh(n)
    return NotificationResponse.model_validate(n)


@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.get("/settings")
async def get_settings(
    current_user: User = Depends(_get_current_user),
):
    settings = current_user.settings or {}
    return {
        "email_notifications": settings.get("email_notifications", True),
    }


@router.put("/settings")
async def update_settings(
    body: NotificationSettingsUpdate,
    current_user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_settings = dict(current_user.settings or {})
    if body.email_notifications is not None:
        current_settings["email_notifications"] = body.email_notifications
    current_user.settings = current_settings
    await db.commit()
    return {"message": "Settings updated", **current_settings}
