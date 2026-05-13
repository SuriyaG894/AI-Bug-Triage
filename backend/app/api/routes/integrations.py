from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from app.core.database import get_db
from app.models import Integration
from app.schemas import (
    IntegrationCreate,
    IntegrationUpdate,
    IntegrationResponse,
    IntegrationStatusResponse,
)

router = APIRouter()


@router.get("", response_model=List[IntegrationResponse])
async def list_integrations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Integration))
    integrations = result.scalars().all()
    return [IntegrationResponse.model_validate(i) for i in integrations]


@router.post("", response_model=IntegrationResponse)
async def create_integration(
    integration: IntegrationCreate, db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(
        select(Integration).where(Integration.tool_type == integration.tool_type)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Integration for {integration.tool_type} already exists",
        )

    config = integration.config or {}
    if integration.org:
        config["org"] = integration.org
    if integration.project:
        config["project"] = integration.project

    new_integration = Integration(
        tool_type=integration.tool_type,
        name=integration.name,
        auth_type=integration.auth_type,
        credentials=integration.credentials,
        config=config,
    )
    db.add(new_integration)
    await db.commit()
    await db.refresh(new_integration)
    return new_integration


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(integration_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    return integration


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: int,
    integration_update: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    update_data = integration_update.model_dump(exclude_unset=True)
    
    if "org" in update_data or "project" in update_data:
        config = dict(integration.config or {})
        if "org" in update_data:
            config["org"] = update_data.pop("org")
        if "project" in update_data:
            config["project"] = update_data.pop("project")
        update_data["config"] = config

    for field, value in update_data.items():
        setattr(integration, field, value)

    await db.commit()
    await db.refresh(integration)
    return integration


@router.delete("/{integration_id}")
async def delete_integration(integration_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    await db.delete(integration)
    await db.commit()
    return {"message": "Integration deleted successfully"}


@router.post("/{integration_id}/sync")
async def trigger_sync(integration_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    from app.services.sync_service import _sync_service
    sync_result = await _sync_service.sync_ado_bugs()

    return {
        "message": f"Sync triggered for {integration.tool_type}",
        "integration_id": integration_id,
        "result": sync_result,
    }


@router.get("/{integration_id}/status", response_model=IntegrationStatusResponse)
async def get_integration_status(
    integration_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    return IntegrationStatusResponse(
        id=integration.id,
        tool_type=integration.tool_type,
        name=integration.name,
        is_active=integration.is_active,
        is_connected=bool(integration.credentials),
        last_sync_at=integration.last_sync_at,
    )
