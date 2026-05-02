from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import httpx

from app.core.database import get_db, User, Bug, Integration, Project, UserProjectAssignment
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


class TestCredentialsRequest(BaseModel):
    tool_type: str
    credentials: str


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


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    ado_project_id: Optional[str] = None
    ado_project_name: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    ado_project_id: Optional[str]
    ado_project_name: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: Optional[datetime] = None


class UserProjectAssignRequest(BaseModel):
    user_ids: List[int]


class UserProjectAssignmentResponse(BaseModel):
    id: int
    user_id: int
    user_email: str
    user_full_name: Optional[str]
    project_id: int


class ProjectWithAssignments(BaseModel):
    id: int
    name: str
    ado_project_id: Optional[str]
    ado_project_name: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: Optional[datetime] = None
    assigned_users: List[Dict[str, Any]] = []


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


@router.post("/integrations/test-credentials")
async def test_integration_credentials(
    data: TestCredentialsRequest,
    admin: User = Depends(require_admin)
):
    """Test integration credentials without saving (admin only)."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[test-credentials] Called by admin user: {admin.email}, tool_type: {data.tool_type}")
    
    if data.tool_type == "azure_devops":
        from app.services.integrations.azure_devops import AzureDevOpsClient
        from app.core.config import settings
        
        org = getattr(settings, 'AZURE_DEVOPS_ORG', None)
        project = getattr(settings, 'AZURE_DEVOPS_PROJECT', None)
        
        if not org or not project:
            raise HTTPException(
                status_code=400,
                detail="AZURE_DEVOPS_ORG and AZURE_DEVOPS_PROJECT must be configured in backend"
            )
        
        client = AzureDevOpsClient(org=org, project=project, pat=data.credentials)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                headers = client._get_headers()
                response = await http_client.get(
                    f"https://dev.azure.com/{org}/_apis/projects",
                    headers=headers,
                    params={"api-version": "7.1"}
                )
                
                if response.status_code == 200:
                    projects_data = response.json()
                    project_count = len(projects_data.get("value", []))
                    return {
                        "status": "connected",
                        "message": f"Connected successfully. Found {project_count} project(s)."
                    }
                elif response.status_code == 401:
                    raise HTTPException(status_code=400, detail="Invalid credentials - authentication failed")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Connection failed (HTTP {response.status_code}): {response.text}"
                    )
        except httpx.RequestError as e:
            raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")
    
    elif data.tool_type == "jira":
        from app.services.integrations.jira import JiraClient
        from app.core.config import settings
        
        base_url = getattr(settings, 'JIRA_BASE_URL', None)
        if not base_url:
            raise HTTPException(
                status_code=400,
                detail="JIRA_BASE_URL must be configured in backend"
            )
        
        client = JiraClient(base_url=base_url, email=getattr(settings, 'JIRA_EMAIL', ''), api_token=data.credentials)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                import base64
                auth = base64.b64encode(f"{client.email}:{client.api_token}".encode()).decode()
                headers = {"Authorization": f"Basic {auth}", "Accept": "application/json"}
                response = await http_client.get(
                    f"{client.base_url}/rest/api/3/myself",
                    headers=headers
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    return {
                        "status": "connected",
                        "message": f"Connected as {user_data.get('displayName', 'unknown')}"
                    }
                elif response.status_code == 401:
                    raise HTTPException(status_code=400, detail="Invalid credentials - authentication failed")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Connection failed (HTTP {response.status_code}): {response.text}"
                    )
        except httpx.RequestError as e:
            raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")
    
    raise HTTPException(status_code=400, detail=f"Unsupported tool type: {data.tool_type}")


# ============================================================================
# Project Management
# ============================================================================

@router.get("/projects", response_model=List[ProjectWithAssignments])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all projects with assigned users (admin only)."""
    result = await db.execute(select(Project).order_by(Project.name))
    projects = result.scalars().all()

    response = []
    for p in projects:
        assignments = await db.execute(
            select(UserProjectAssignment, User.email, User.full_name)
            .join(User, User.id == UserProjectAssignment.user_id)
            .where(UserProjectAssignment.project_id == p.id)
        )
        assigned_users = [
            {"user_id": a[0].user_id, "email": a[1], "full_name": a[2]}
            for a in assignments.all()
        ]
        response.append(ProjectWithAssignments(
            id=p.id,
            name=p.name,
            ado_project_id=p.ado_project_id,
            ado_project_name=p.ado_project_name,
            description=p.description,
            is_active=p.is_active,
            created_at=p.created_at,
            assigned_users=assigned_users
        ))
    return response


@router.get("/projects/{project_id}", response_model=ProjectWithAssignments)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get project details with assignments (admin only)."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    assignments = await db.execute(
        select(UserProjectAssignment, User.email, User.full_name)
        .join(User, User.id == UserProjectAssignment.user_id)
        .where(UserProjectAssignment.project_id == project_id)
    )
    assigned_users = [
        {"user_id": a[0].user_id, "email": a[1], "full_name": a[2]}
        for a in assignments.all()
    ]
    return ProjectWithAssignments(
        id=project.id,
        name=project.name,
        ado_project_id=project.ado_project_id,
        ado_project_name=project.ado_project_name,
        description=project.description,
        is_active=project.is_active,
        created_at=project.created_at,
        assigned_users=assigned_users
    )


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Create a new project (admin only)."""
    project = Project(
        name=data.name,
        description=data.description,
        ado_project_id=data.ado_project_id,
        ado_project_name=data.ado_project_name,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        ado_project_id=project.ado_project_id,
        ado_project_name=project.ado_project_name,
        description=project.description,
        is_active=project.is_active,
        created_at=project.created_at
    )


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Update a project (admin only)."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.is_active is not None:
        project.is_active = data.is_active

    await db.commit()
    await db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        ado_project_id=project.ado_project_id,
        ado_project_name=project.ado_project_name,
        description=project.description,
        is_active=project.is_active,
        created_at=project.created_at
    )


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Delete a project and its assignments (admin only)."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.execute(
        select(UserProjectAssignment).where(
            UserProjectAssignment.project_id == project_id
        )
    )
    assignments = (await db.execute(
        select(UserProjectAssignment).where(
            UserProjectAssignment.project_id == project_id
        )
    )).scalars().all()
    for a in assignments:
        await db.delete(a)

    await db.delete(project)
    await db.commit()
    return {"message": "Project deleted", "project_id": project_id}


@router.post("/projects/{project_id}/assign-users")
async def assign_users_to_project(
    project_id: int,
    data: UserProjectAssignRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Assign users to a project (admin only)."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = (await db.execute(
        select(UserProjectAssignment.user_id).where(
            UserProjectAssignment.project_id == project_id
        )
    )).scalars().all()
    existing_ids = set(existing)

    new_ids = set(data.user_ids) - existing_ids
    removed_ids = existing_ids - set(data.user_ids)

    for uid in new_ids:
        assignment = UserProjectAssignment(user_id=uid, project_id=project_id)
        db.add(assignment)

    for uid in removed_ids:
        result = await db.execute(
            select(UserProjectAssignment).where(
                UserProjectAssignment.user_id == uid,
                UserProjectAssignment.project_id == project_id
            )
        )
        assignment = result.scalar_one_or_none()
        if assignment:
            await db.delete(assignment)

    await db.commit()
    return {"message": "Users assigned", "added": len(new_ids), "removed": len(removed_ids)}


@router.post("/projects/sync-from-ado")
async def sync_projects_from_ado(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Sync projects from Azure DevOps (admin only)."""
    from app.services.integrations.azure_devops import AzureDevOpsClient
    from app.core.config import settings

    org = getattr(settings, 'AZURE_DEVOPS_ORG', None)
    pat = getattr(settings, 'AZURE_DEVOPS_PAT', None)

    if not org or not pat:
        raise HTTPException(
            status_code=400,
            detail="AZURE_DEVOPS_ORG and AZURE_DEVOPS_PAT must be configured"
        )

    client = AzureDevOpsClient(org=org, pat=pat)

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            headers = client._get_headers()
            response = await http_client.get(
                f"https://dev.azure.com/{org}/_apis/projects",
                headers=headers,
                params={"api-version": "7.1"}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch projects from ADO: {response.text}"
                )

            projects_data = response.json().get("value", [])
            synced = 0

            for p in projects_data:
                ado_id = p.get("id")
                ado_name = p.get("name")

                existing = await db.execute(
                    select(Project).where(Project.ado_project_id == ado_id)
                )
                existing_project = existing.scalar_one_or_none()

                if existing_project:
                    existing_project.ado_project_name = ado_name
                    existing_project.name = ado_name
                else:
                    new_project = Project(
                        name=ado_name,
                        ado_project_id=ado_id,
                        ado_project_name=ado_name,
                    )
                    db.add(new_project)
                synced += 1

            await db.commit()
            return {"message": f"Synced {synced} project(s) from ADO", "count": synced}

    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")


# ============================================================================
# User Assigned Projects (for non-admin users)
# ============================================================================

@router.get("/my/projects")
async def get_my_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_optional)
):
    """Get projects assigned to current user."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if user.is_admin:
        result = await db.execute(select(Project).where(Project.is_active == True).order_by(Project.name))
        projects = result.scalars().all()
        return [
            {"id": p.id, "name": p.name, "ado_project_id": p.ado_project_id, "ado_project_name": p.ado_project_name}
            for p in projects
        ]

    result = await db.execute(
        select(Project).join(UserProjectAssignment, UserProjectAssignment.project_id == Project.id)
        .where(UserProjectAssignment.user_id == user.id, Project.is_active == True)
        .order_by(Project.name)
    )
    projects = result.scalars().all()
    return [
        {"id": p.id, "name": p.name, "ado_project_id": p.ado_project_id, "ado_project_name": p.ado_project_name}
        for p in projects
    ]