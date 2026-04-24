from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text
from sqlalchemy.dialects.postgresql import array
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.config import settings
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
    BugSuggestionRequest,
    BugSuggestionResponse,
)
from app.services.ai import classify_bug, suggest_root_causes, generate_embedding

router = APIRouter()


@router.post("/suggest", response_model=BugSuggestionResponse)
async def suggest_bug_fields(
    request: BugSuggestionRequest, db: AsyncSession = Depends(get_db)
):
    combined_text = f"{request.title}. {request.description}"
    if request.repro_steps:
        combined_text += f" Steps: {request.repro_steps}"
    
    classification = {"severity": "medium", "type": "general", "confidence": 0.5}
    
    try:
        classification = await classify_bug(combined_text)
    except Exception:
        pass
    
    priority = "medium"
    reasoning_parts = []
    
    severity = classification.get("severity", "medium")
    bug_type = classification.get("type", "general")
    confidence = classification.get("confidence", 0.5)
    
    if severity == "critical":
        priority = "critical"
        reasoning_parts.append("Critical severity detected - set to highest priority")
    elif severity == "high":
        priority = "high"
        reasoning_parts.append("High severity issue - elevated priority")
    elif severity in ["crash", "data_loss", "security"]:
        priority = "critical"
        reasoning_parts.append(f"Type '{bug_type}' suggests immediate attention")
    else:
        reasoning_parts.append("Standard issue processing")
    
    if request.repro_steps and len(request.repro_steps) > 50:
        reasoning_parts.append("Detailed repro steps provided - helps faster resolution")
    
    return BugSuggestionResponse(
        priority=priority,
        severity=severity,
        bug_type=bug_type,
        confidence=confidence,
        reasoning="; ".join(reasoning_parts)
    )


@router.post("", response_model=BugResponse)
async def create_bug(bug: BugCreate, db: AsyncSession = Depends(get_db)):
    classification = {"severity": "medium", "type": "general", "confidence": 0.5}
    
    try:
        combined_text = f"{bug.title}. {bug.description}"
        if bug.repro_steps:
            combined_text += f" Steps: {bug.repro_steps}"
        classification = await classify_bug(combined_text)
    except Exception:
        pass
    
    priority = bug.priority or classification.get("severity", "medium")
    severity = bug.severity or classification.get("severity", "medium")
    
    new_bug = Bug(
        title=bug.title,
        description=bug.description,
        priority=priority,
        severity=severity,
        type=classification.get("type", "general"),
        repro_steps=bug.repro_steps,
        assigned_to=bug.assigned_to,
        created_by=bug.created_by,
    )
    db.add(new_bug)
    await db.commit()
    await db.refresh(new_bug)
    
    if settings.groq_api_key_decrypted:
        try:
            embedding = await generate_embedding(bug.description)
            if embedding and len(embedding) >= 1536:
                db.add(BugEmbedding(bug_id=new_bug.id, embedding=embedding))
                await db.commit()
        except Exception:
            pass
        
        try:
            causes = await suggest_root_causes(bug.description, classification)
            if causes:
                analysis = AnalysisResult(
                    bug_id=new_bug.id,
                    root_causes=causes,
                    confidence_scores={c.get("cause", ""): c.get("confidence", 0) for c in causes}
                )
                db.add(analysis)
                await db.commit()
        except Exception:
            pass
    
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


async def check_azure_devops_duplicates(request_description: str, request_title: str) -> List[SimilarBug]:
    """Check Azure DevOps for duplicate work items"""
    from app.services.integrations.azure_devops import create_azure_client
    from app.core.config import decrypt_api_key
    
    similar = []
    if not settings.AZURE_DEVOPS_ORG or not settings.AZURE_DEVOPS_PROJECT or not settings.AZURE_DEVOPS_PAT:
        return similar
    
    try:
        pat = settings.AZURE_DEVOPS_PAT
        if pat.startswith("ENC:"):
            pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)
        
        client = create_azure_client(pat)
        if not client:
            return similar
        
        work_items = await client.get_work_items(states=["New", "Active", "In Progress"])
        
        for item in work_items:
            title = item.get("webUrl", "") or ""
            ext_id = str(item.get("id", ""))
            
            similarity = calculate_text_similarity(request_title, title)
            if similarity > 0.5:
                similar.append(
                    SimilarBug(
                        id=None,
                        title=title,
                        description=request_description,
                        severity="",
                        type="",
                        status=item.get("state", ""),
                        source="azure_devops",
                        similarity=similarity,
                        external_url=f"https://dev.azure.com/{settings.AZURE_DEVOPS_ORG}/{settings.AZURE_DEVOPS_PROJECT}/_workitems/edit/{ext_id}",
                        external_id=ext_id,
                    )
                )
    except Exception:
        pass
    
    return similar


async def check_jira_duplicates(request_description: str, request_title: str, project_key: str = "BUGS") -> List[SimilarBug]:
    """Check JIRA for duplicate issues"""
    from app.services.integrations.jira import create_jira_client
    from app.core.config import decrypt_api_key
    
    similar = []
    if not settings.JIRA_BASE_URL or not settings.JIRA_EMAIL or not settings.JIRA_API_TOKEN:
        return similar
    
    try:
        api_token = settings.JIRA_API_TOKEN
        if api_token.startswith("ENC:"):
            api_token = decrypt_api_key(api_token, settings.ENCRYPTION_KEY)
        
        client = create_jira_client(settings.JIRA_BASE_URL, settings.JIRA_EMAIL, api_token)
        if not client:
            return similar
        
        issues = await client.search_issues(project_key, max_results=20)
        
        for issue in issues:
            fields = issue.get("fields", {})
            title = fields.get("summary", "")
            ext_id = issue.get("key", "")
            status = fields.get("status", {}).get("name", "")
            
            similarity = calculate_text_similarity(request_title, title)
            if similarity > 0.5:
                similar.append(
                    SimilarBug(
                        id=None,
                        title=title,
                        description=fields.get("description", {}).get("content", [{}])[0].get("content", [{}])[0].get("text", "") if fields.get("description") else "",
                        severity="",
                        type="",
                        status=status,
                        source="jira",
                        similarity=similarity,
                        external_url=f"{settings.JIRA_BASE_URL}/browse/{ext_id}",
                        external_id=ext_id,
                    )
                )
    except Exception:
        pass
    
    return similar


def calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate text similarity based on word overlap"""
    if not text1 or not text2:
        return 0.0
    
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union) if union else 0.0


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    request: DuplicateCheckRequest, db: AsyncSession = Depends(get_db)
):
    similar_bugs = []
    embedding = await generate_embedding(request.description)
    
    if embedding:
        result = await db.execute(
            select(Bug, BugEmbedding)
            .join(BugEmbedding, Bug.id == BugEmbedding.bug_id)
            .limit(10)
        )
        rows = result.all()
        
        for bug, emb in rows:
            if emb is not None:
                emb_array = emb.embedding
                if emb_array is not None and len(emb_array) > 0:
                    similarity = calculate_cosine_similarity(embedding, list(emb_array))
                    if similarity > 0.7:
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
    
    if not similar_bugs:
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

    azure_bugs = await check_azure_devops_duplicates(request.description, request.title)
    similar_bugs.extend(azure_bugs)
    
    jira_bugs = await check_jira_duplicates(request.description, request.title)
    similar_bugs.extend(jira_bugs)
    
    similar_bugs.sort(key=lambda x: x.similarity, reverse=True)
    similar_bugs = similar_bugs[:5]

    is_duplicate = len(similar_bugs) > 0 and similar_bugs[0].similarity > 0.8

    return DuplicateCheckResponse(
        is_duplicate=is_duplicate,
        similar_bugs=similar_bugs,
        message="Potential duplicates found" if similar_bugs else "No duplicates found",
    )


def calculate_cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    
    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = sum(x * x for x in a) ** 0.5
    magnitude_b = sum(y * y for y in b) ** 0.5
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)


@router.post("/{bug_id}/push")
async def push_bug_to_external(
    bug_id: int,
    tool_type: str,
    project_key: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Push a bug to Azure DevOps or JIRA"""
    from app.schemas import PushBugResponse
    from app.services.integrations.azure_devops import create_azure_client
    from app.services.integrations.jira import create_jira_client
    
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    if tool_type == "azure_devops":
        client = create_azure_client(settings.AZURE_DEVOPS_PAT or "")
        if not client:
            return PushBugResponse(
                success=False,
                message="Azure DevOps not configured",
            )
        
        result = await client.create_work_item(
            title=bug.title,
            description=bug.description,
            severity=bug.severity,
            bug_type=bug.type,
            priority_value=bug.priority,
            repro_steps=bug.repro_steps,
            assigned_to=bug.assigned_to,
        )
        return PushBugResponse(**result)
    
    elif tool_type == "jira":
        client = create_jira_client(
            base_url=settings.JIRA_BASE_URL or "",
            email=settings.JIRA_EMAIL or "",
            api_token=settings.JIRA_API_TOKEN or "",
        )
        if not client:
            return PushBugResponse(
                success=False,
                message="JIRA not configured",
            )
        
        project = project_key or "BUG"
        result = await client.create_issue(
            title=bug.title,
            description=bug.description,
            severity=bug.severity,
            bug_type=bug.type,
            project_key=project,
        )
        return PushBugResponse(**result)
    
    return PushBugResponse(success=False, message="Unknown tool type")