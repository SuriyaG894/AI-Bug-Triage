from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional

from app.core.database import get_db, AuditLog, User
from app.api.routes.auth import get_current_user_optional, require_admin
from app.schemas.audit import AuditLogListResponse, AuditLogResponse
from app.services.audit_service import cleanup_old_audit_logs

router = APIRouter(tags=["audit"])


async def _cleanup_if_needed(db: AsyncSession):
    import random
    if random.random() < 0.01:
        try:
            await cleanup_old_audit_logs(db)
        except Exception:
            pass


@router.get("/api/audit/logs", response_model=AuditLogListResponse)
async def get_my_audit_logs(
    days: Optional[int] = Query(7, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)

    base_query = select(AuditLog).where(
        AuditLog.user_id == current_user.id,
        AuditLog.created_at >= cutoff,
    )

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = base_query.order_by(desc(AuditLog.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    await _cleanup_if_needed(db)

    return AuditLogListResponse(
        total=total,
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        page=page,
        page_size=page_size,
    )


@router.get("/api/admin/audit-logs", response_model=AuditLogListResponse)
async def get_all_audit_logs(
    user_id: Optional[int] = Query(None),
    user_email: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    days: Optional[int] = Query(7, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)

    conditions = [AuditLog.created_at >= cutoff]
    if user_id is not None:
        conditions.append(AuditLog.user_id == user_id)
    if user_email is not None:
        conditions.append(AuditLog.user_email.ilike(f"%{user_email}%"))
    if action is not None:
        conditions.append(AuditLog.action == action)

    base_query = select(AuditLog).where(*conditions)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = base_query.order_by(desc(AuditLog.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    await _cleanup_if_needed(db)

    return AuditLogListResponse(
        total=total,
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        page=page,
        page_size=page_size,
    )
