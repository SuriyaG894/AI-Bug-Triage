from fastapi import APIRouter, Depends
from typing import Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncConfigRequest(BaseModel):
    interval_minutes: int = 15


@router.get("/status")
async def get_sync_status() -> Dict[str, Any]:
    """Get sync status and configuration."""
    from app.services.sync_service import get_sync_status as _get_status
    return await _get_status()


@router.post("/trigger")
async def trigger_sync() -> Dict[str, Any]:
    """Manually trigger a full sync from ADO to local."""
    from app.services.sync_service import trigger_sync as _trigger
    return await _trigger()


@router.post("/trigger/{bug_id}")
async def trigger_single_bug_sync(bug_id: int) -> Dict[str, Any]:
    """Trigger sync for a single bug by ID."""
    from app.services.sync_service import trigger_single_bug_sync as _trigger
    return await _trigger(bug_id)


@router.post("/config")
async def update_sync_config(request: SyncConfigRequest) -> Dict[str, Any]:
    """Update sync configuration."""
    from app.services.sync_service import update_sync_config as _update
    return await _update(request.interval_minutes)


@router.post("/start")
async def start_sync_scheduler() -> Dict[str, Any]:
    """Start the sync scheduler."""
    from app.services.sync_service import _sync_service
    return await _sync_service.start_scheduler()


@router.post("/stop")
async def stop_sync_scheduler() -> Dict[str, Any]:
    """Stop the sync scheduler."""
    from app.services.sync_service import _sync_service
    return await _sync_service.stop_scheduler()
