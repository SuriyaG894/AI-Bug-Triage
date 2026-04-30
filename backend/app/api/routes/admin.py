from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.database import get_db, User, Bug, Integration
from app.api.routes.auth import require_admin, decode_token, get_current_user_optional

router = APIRouter(prefix="/api/admin", tags=["admin"])
security = HTTPBearer(auto_error=False)


# ============================================================================
# Pydantic Models
# ============================================================================

class UserUpdateRole(BaseModel):
    is_admin: bool


class UserUpdateStatus(BaseModel):
    is_active: bool


class AdminUserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: Optional[datetime] = None


class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_bugs: int
    open_bugs: int
    closed_bugs: int
    synced_bugs: int


class SyncConfigUpdate(BaseModel):
    interval_minutes: int
    auto_sync_enabled: bool


class AdminSyncStatus(BaseModel):
    is_running: bool
    interval_minutes: int
    auto_sync_enabled: bool
    last_sync_at: Optional[str]
    last_sync_result: Optional[Dict[str, Any]]
    total_synced: int


class AuditLogResponse(BaseModel):
    id: int
    action: str
    user_email: Optional[str]
    details: Optional[str]
    created_at: datetime


# ============================================================================
# User Management
# ============================================================================

@router.get("/users", response_model=List[AdminUserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all users (admin only)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    
    return [
        AdminUserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_admin=u.is_admin,
            created_at=u.created_at
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get user details (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at
    )


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    data: UserUpdateRole,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Update user role (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_admin = data.is_admin
    await db.commit()
    
    return {"message": "User role updated", "user_id": user_id, "is_admin": data.is_admin}


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    data: UserUpdateStatus,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Activate or deactivate user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = data.is_active
    await db.commit()
    
    return {"message": "User status updated", "user_id": user_id, "is_active": data.is_active}


# ============================================================================
# Dashboard Stats
# ============================================================================

@router.get("/dashboard/stats", response_model=AdminDashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get dashboard statistics (admin only)."""
    total_users = await db.execute(select(func.count(User.id)))
    total_users = total_users.scalar() or 0
    
    active_users = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    active_users = active_users.scalar() or 0
    
    total_bugs = await db.execute(select(func.count(Bug.id)))
    total_bugs = total_bugs.scalar() or 0
    
    open_bugs = await db.execute(select(func.count(Bug.id)).where(Bug.status == "open"))
    open_bugs = open_bugs.scalar() or 0
    
    closed_bugs = await db.execute(select(func.count(Bug.id)).where(Bug.status == "closed"))
    closed_bugs = closed_bugs.scalar() or 0
    
    from app.core.database import ExternalIssueCache
    synced_bugs = await db.execute(select(func.count(ExternalIssueCache.id)))
    synced_bugs = synced_bugs.scalar() or 0
    
    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_bugs=total_bugs,
        open_bugs=open_bugs,
        closed_bugs=closed_bugs,
        synced_bugs=synced_bugs
    )


# ============================================================================
# Sync Management
# ============================================================================

@router.get("/sync/status", response_model=AdminSyncStatus)
async def get_sync_status(
    admin: User = Depends(require_admin)
):
    """Get sync status (admin only)."""
    from app.services.sync_service import _sync_service
    from app.core.config import settings
    
    is_running = _sync_service.is_running()
    interval_minutes = getattr(settings, 'SYNC_INTERVAL_MINUTES', 15)
    auto_sync_enabled = interval_minutes > 0
    
    return AdminSyncStatus(
        is_running=is_running,
        interval_minutes=interval_minutes,
        auto_sync_enabled=auto_sync_enabled,
        last_sync_at=None,
        last_sync_result=None,
        total_synced=0
    )


@router.post("/sync/trigger")
async def trigger_sync(
    admin: User = Depends(require_admin)
):
    """Manually trigger sync (admin only)."""
    from app.services.sync_service import trigger_sync as _trigger
    return await _trigger()


@router.post("/sync/config")
async def update_sync_config(
    data: SyncConfigUpdate,
    admin: User = Depends(require_admin)
):
    """Update sync configuration (admin only)."""
    from app.services.sync_service import update_sync_config as _update
    result = await _update(data.interval_minutes)
    
    if data.auto_sync_enabled and data.interval_minutes > 0:
        from app.services.sync_service import _sync_service
        if not _sync_service.is_running():
            await _sync_service.start_scheduler()
    elif not data.auto_sync_enabled:
        from app.services.sync_service import _sync_service
        if _sync_service.is_running():
            await _sync_service.stop_scheduler()
    
    return result


@router.post("/sync/start")
async def start_sync(
    admin: User = Depends(require_admin)
):
    """Start sync scheduler (admin only)."""
    from app.services.sync_service import _sync_service
    return await _sync_service.start_scheduler()


@router.post("/sync/stop")
async def stop_sync(
    admin: User = Depends(require_admin)
):
    """Stop sync scheduler (admin only)."""
    from app.services.sync_service import _sync_service
    return await _sync_service.stop_scheduler()


# ============================================================================
# Integration Management (Existing routes with admin requirement)
# ============================================================================

@router.get("/integrations", response_model=List[Dict[str, Any]])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all integrations (admin only)."""
    result = await db.execute(select(Integration))
    integrations = result.scalars().all()
    
    return [
        {
            "id": i.id,
            "tool_type": i.tool_type,
            "name": i.name,
            "auth_type": i.auth_type,
            "is_active": i.is_active,
            "is_connected": bool(i.credentials),
            "last_sync_at": i.last_sync_at.isoformat() if i.last_sync_at else None,
            "created_at": i.created_at.isoformat()
        }
        for i in integrations
    ]


@router.post("/integrations/test/{integration_id}")
async def test_integration(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Test integration connection (admin only)."""
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    if integration.tool_type == "azure_devops":
        from app.services.integrations.azure_devops import AzureDevOpsService
        service = AzureDevOpsService()
        connected = await service.test_connection(integration.credentials, integration.config)
        return {"status": "connected" if connected else "failed", "tool_type": integration.tool_type}
    elif integration.tool_type == "jira":
        from app.services.integrations.jira import JiraService
        service = JiraService()
        connected = await service.test_connection(integration.credentials, integration.config)
        return {"status": "connected" if connected else "failed", "tool_type": integration.tool_type}
    
    return {"status": "unknown", "message": f"Unknown tool type: {integration.tool_type}"}