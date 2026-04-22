from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.models import Bug, AnalysisResult, BugEmbedding
from app.schemas import (
    BugCreate,
    BugUpdate,
    BugResponse,
    BugWithAnalysis,
    BugListResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    SimilarBug,
)

router = APIRouter()


@router.post("", response_model=BugResponse)
async def create_bug(bug: BugCreate, db: AsyncSession = Depends(get_db)):
    new_bug = Bug(
        title=bug.title,
        description=bug.description,
        severity="medium",
        type="general",
        created_by=bug.created_by,
    )
    db.add(new_bug)
    await db.commit()
    await db.refresh(new_bug)
    return new_bug


@router.get("", response_model=BugListResponse)
async def list_bugs(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    severity: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Bug)

    if severity:
        query = query.where(Bug.severity == severity)
    if type:
        query = query.where(Bug.type == type)
    if status:
        query = query.where(Bug.status == status)
    if search:
        query = query.where(
            or_(
                Bug.title.ilike(f"%{search}%"),
                Bug.description.ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Bug.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bugs = result.scalars().all()

    return BugListResponse(
        total=total or 0, bugs=[BugResponse.model_validate(b) for b in bugs]
    )


@router.get("/{bug_id}", response_model=BugWithAnalysis)
async def get_bug(bug_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    analysis_result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.bug_id == bug_id)
    )
    analysis = analysis_result.scalar_one_or_none()

    bug_response = BugWithAnalysis.model_validate(bug)
    if analysis:
        bug_response.analysis = analysis

    return bug_response


@router.put("/{bug_id}", response_model=BugResponse)
async def update_bug(
    bug_id: int, bug_update: BugUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    update_data = bug_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bug, field, value)

    bug.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(bug)
    return bug


@router.delete("/{bug_id}")
async def delete_bug(bug_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    await db.delete(bug)
    await db.commit()
    return {"message": "Bug deleted successfully"}


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    request: DuplicateCheckRequest, db: AsyncSession = Depends(get_db)
):
    similar_bugs = []
    is_duplicate = False

    result = await db.execute(
        select(Bug)
        .where(
            or_(
                Bug.title.ilike(f"%{request.description[:50]}%"),
                Bug.description.ilike(f"%{request.description[:50]}%"),
            )
        )
        .limit(5)
    )
    bugs = result.scalars().all()

    for bug in bugs:
        similarity = 0.75 if bug.title.lower() in request.description.lower() else 0.5
        similar_bugs.append(
            SimilarBug(
                id=bug.id,
                title=bug.title,
                description=bug.description,
                severity=bug.severity,
                type=bug.type,
                status=bug.status,
                source=bug.source,
                similarity=similarity,
            )
        )

    if similar_bugs:
        is_duplicate = similar_bugs[0].similarity > 0.8

    return DuplicateCheckResponse(
        is_duplicate=is_duplicate,
        similar_bugs=similar_bugs,
        message="Potential duplicates found" if similar_bugs else "No duplicates found",
    )
