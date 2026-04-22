from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any, List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models import Bug, AnalysisResult

router = APIRouter()


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    from sqlalchemy import and_

    total_bugs = await db.scalar(select(func.count(Bug.id)))
    open_bugs = await db.scalar(select(func.count(Bug.id)).where(Bug.status == "open"))
    critical_bugs = await db.scalar(
        select(func.count(Bug.id)).where(Bug.severity == "critical")
    )
    resolved_bugs = await db.scalar(
        select(func.count(Bug.id)).where(Bug.status == "resolved")
    )

    return {
        "total_bugs": total_bugs or 0,
        "open_bugs": open_bugs or 0,
        "critical_bugs": critical_bugs or 0,
        "resolved_bugs": resolved_bugs or 0,
    }


@router.get("/severity-distribution")
async def get_severity_distribution(
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Bug.severity, func.count(Bug.id).label("count")).group_by(Bug.severity)
    )
    return [{"severity": row.severity, "count": row.count} for row in result]


@router.get("/type-distribution")
async def get_type_distribution(
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Bug.type, func.count(Bug.id).label("count")).group_by(Bug.type)
    )
    return [{"type": row.type, "count": row.count} for row in result]


@router.get("/trends")
async def get_trends(
    days: int = 30, db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(Bug.created_at).label("date"), func.count(Bug.id).label("count")
        )
        .where(Bug.created_at >= start_date)
        .group_by(func.date(Bug.created_at))
        .order_by(func.date(Bug.created_at))
    )

    return [{"date": str(row.date), "count": row.count} for row in result]


@router.get("/common-root-causes")
async def get_common_root_causes(
    limit: int = 10, db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
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
