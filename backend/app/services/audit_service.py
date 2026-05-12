from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta

from app.core.database import AuditLog


async def log_audit(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    action: str,
    entity_type: str = None,
    entity_id: int = None,
    details: dict = None,
    ip_address: str = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def cleanup_old_audit_logs(db: AsyncSession, days: int = 30):
    cutoff = datetime.utcnow() - timedelta(days=days)
    await db.execute(
        delete(AuditLog).where(AuditLog.created_at < cutoff)
    )
    await db.commit()
