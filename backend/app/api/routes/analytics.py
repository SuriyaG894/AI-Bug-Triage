from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db, Bug, AnalysisResult, User, UserProjectAssignment
from app.api.routes.auth import get_current_user

router = APIRouter()


async def _get_user_project_filter(
    db: AsyncSession,
    user: Optional[User],
    requested_project_id: Optional[int] = None
):
    """Return a WHERE clause fragment for user's projects. None = no filter (admin)."""
    if not user or user.is_admin:
        if requested_project_id is not None:
            return [requested_project_id]
        return None

    result = await db.execute(
        select(UserProjectAssignment.project_id).where(
            UserProjectAssignment.user_id == user.id
        )
    )
    project_ids = result.scalars().all()
    if not project_ids:
        return []

    if requested_project_id is not None:
        if requested_project_id in project_ids:
            return [requested_project_id]
        return []

    return project_ids


def _apply_project_filter(query, project_ids, is_specific: bool = False):
    """Apply project filter to query. project_ids=[] returns empty filter, None = no filter."""
    if project_ids is None:
        return query
    if not project_ids:
        return query.where(Bug.project_id == -1)

    return query.where(Bug.project_id.in_(project_ids))


@router.get("/summary")
async def get_summary(
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    project_ids = await _get_user_project_filter(db, current_user, project_id)

    if project_ids == []:
        return {
            "total_bugs": 0,
            "open_bugs": 0,
            "critical_bugs": 0,
            "resolved_bugs": 0,
        }

    is_specific = project_id is not None
    base = _apply_project_filter(select(func.count(Bug.id)), project_ids, is_specific)
    total_bugs = await db.scalar(base)

    open_bugs = await db.scalar(
        _apply_project_filter(select(func.count(Bug.id)).where(Bug.status == "open"), project_ids, is_specific)
    )
    critical_bugs = await db.scalar(
        _apply_project_filter(select(func.count(Bug.id)).where(Bug.severity == "critical"), project_ids, is_specific)
    )
    resolved_bugs = await db.scalar(
        _apply_project_filter(select(func.count(Bug.id)).where(Bug.status == "resolved"), project_ids, is_specific)
    )

    return {
        "total_bugs": total_bugs or 0,
        "open_bugs": open_bugs or 0,
        "critical_bugs": critical_bugs or 0,
        "resolved_bugs": resolved_bugs or 0,
    }


@router.get("/severity-distribution")
async def get_severity_distribution(
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    project_ids = await _get_user_project_filter(db, current_user, project_id)
    if project_ids == []:
        return []

    is_specific = project_id is not None
    result = await db.execute(
        _apply_project_filter(
            select(Bug.severity, func.count(Bug.id).label("count")).group_by(Bug.severity),
            project_ids,
            is_specific
        )
    )
    return [{"severity": row.severity, "count": row.count} for row in result]


@router.get("/type-distribution")
async def get_type_distribution(
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    project_ids = await _get_user_project_filter(db, current_user, project_id)
    if project_ids == []:
        return []

    is_specific = project_id is not None
    result = await db.execute(
        _apply_project_filter(
            select(Bug.type, func.count(Bug.id).label("count")).group_by(Bug.type),
            project_ids,
            is_specific
        )
    )
    return [{"type": row.type, "count": row.count} for row in result]


@router.get("/trends")
async def get_trends(
    days: int = 30,
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    start_date = datetime.utcnow() - timedelta(days=days)
    project_ids = await _get_user_project_filter(db, current_user, project_id)

    if project_ids == []:
        return []

    is_specific = project_id is not None
    base_query = (
        select(
            func.date(Bug.created_at).label("date"), func.count(Bug.id).label("count")
        )
        .where(Bug.created_at >= start_date)
        .group_by(func.date(Bug.created_at))
        .order_by(func.date(Bug.created_at))
    )

    result = await db.execute(
        _apply_project_filter(base_query, project_ids, is_specific)
    )
    return [{"date": str(row.date), "count": row.count} for row in result]


@router.get("/common-root-causes")
async def get_common_root_causes(
    limit: int = 10,
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    project_ids = await _get_user_project_filter(db, current_user, project_id)

    if project_ids == []:
        return []

    if project_ids is not None:
        from sqlalchemy import or_
        if project_id is not None:
            bug_ids = await db.execute(
                select(Bug.id).where(Bug.project_id.in_(project_ids))
            )
        else:
            bug_ids = await db.execute(
                select(Bug.id).where(
                    or_(
                        Bug.project_id.in_(project_ids),
                        Bug.project_id.is_(None)
                    )
                )
            )
        bug_ids = [r[0] for r in bug_ids.all()]
        if not bug_ids:
            return []
        result = await db.execute(
            select(AnalysisResult).where(AnalysisResult.bug_id.in_(bug_ids)).limit(100)
        )
    else:
        result = await db.execute(select(AnalysisResult).limit(100))

    analyses = result.scalars().all()

    cause_counts: Dict[str, int] = {}
    for analysis in analyses:
        if analysis.root_causes:
            for cause in analysis.root_causes:
                cause_name = (
                    cause.get("cause", "Unknown")
                    if isinstance(cause, dict)
                    else str(cause)
                )
                cause_counts[cause_name] = cause_counts.get(cause_name, 0) + 1

    sorted_causes = sorted(cause_counts.items(), key=lambda x: x[1], reverse=True)[
        :limit
    ]
    return [{"cause": cause, "count": count} for cause, count in sorted_causes]
