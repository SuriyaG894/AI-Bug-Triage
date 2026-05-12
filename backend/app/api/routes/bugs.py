from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text
from sqlalchemy.dialects.postgresql import array
from typing import Optional, List
from datetime import datetime
import json

from app.core.database import get_db, User, Project, UserProjectAssignment
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
from app.services.audit_service import log_audit

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current authenticated user from JWT token."""
    if not credentials:
        return None
    
    from app.api.routes.auth import decode_token, TokenData
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        return None
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    return result.scalar_one_or_none()


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
async def create_bug(
    bug: BugCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_from_token)
):
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

    # Auto-set created_by and reporter_id from authenticated user
    bug_created_by = current_user.email if current_user else None
    bug_reporter_id = current_user.id if current_user else None

    # Validate project access for non-admin users
    if bug.project_id and current_user and not current_user.is_admin:
        assignment = await db.execute(
            select(UserProjectAssignment).where(
                UserProjectAssignment.user_id == current_user.id,
                UserProjectAssignment.project_id == bug.project_id
            )
        )
        if not assignment.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You are not assigned to this project")

    new_bug = Bug(
        title=bug.title,
        description=bug.description,
        priority=priority,
        severity=severity,
        type=classification.get("type", "general"),
        repro_steps=bug.repro_steps,
        expected_result=bug.expected_result,
        actual_result=bug.actual_result,
        attachments=bug.attachments,
        assigned_to=bug.assigned_to,
        created_by=bug_created_by,
        reporter_id=bug_reporter_id,
        duplicate_justification=bug.duplicate_justification,
        duplicate_of_external_ids=bug.duplicate_of_external_ids,
        project_id=bug.project_id,
    )
    db.add(new_bug)
    await db.commit()
    await db.refresh(new_bug)

    await log_audit(db, bug_reporter_id or 0, bug_created_by or "", "bug.create",
                    entity_type="bug", entity_id=new_bug.id,
                    details={"title": new_bug.title, "severity": severity})

    if settings.groq_api_key_decrypted:
        try:
            embedding = await generate_embedding(bug.description)
            if embedding and len(embedding) >= 384:
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
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_from_token),
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

    # Restrict non-admin users to their assigned projects
    if current_user and not current_user.is_admin:
        assigned_project_ids = (await db.execute(
            select(UserProjectAssignment.project_id).where(
                UserProjectAssignment.user_id == current_user.id
            )
        )).scalars().all()
        if assigned_project_ids:
            # Show bugs in assigned projects AND unassigned bugs (project_id is NULL)
            query = query.where(
                or_(
                    Bug.project_id.in_(assigned_project_ids),
                    Bug.project_id.is_(None)
                )
            )
        else:
            # No assigned projects, return empty list
            return BugListResponse(total=0, bugs=[])

    # Apply project filter if specified
    if project_id:
        query = query.where(
            or_(
                Bug.project_id == project_id,
                Bug.project_id.is_(None)
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
    bug_id: int,
    bug_update: BugUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_from_token),
):
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not current_user.is_admin and bug.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit bugs you created")

    update_data = bug_update.model_dump(exclude_unset=True)
    description_changed = "description" in update_data and update_data["description"] != bug.description

    for field, value in update_data.items():
        setattr(bug, field, value)

    bug.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(bug)

    changed_fields = [f for f in update_data.keys() if f != "updated_at"]
    if changed_fields:
        await log_audit(db, current_user.id, current_user.email, "bug.update",
                        entity_type="bug", entity_id=bug.id,
                        details={"changed_fields": changed_fields, "title": bug.title})

    if description_changed and settings.groq_api_key_decrypted:
        try:
            await db.execute(
                text("DELETE FROM bug_embeddings WHERE bug_id = :bid"),
                {"bid": bug_id}
            )
            embedding = await generate_embedding(bug.description)
            if embedding and len(embedding) >= 384:
                db.add(BugEmbedding(bug_id=bug.id, embedding=embedding))
                await db.commit()
        except Exception:
            pass

    return bug


@router.delete("/{bug_id}")
async def delete_bug(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_from_token),
):
    result = await db.execute(select(Bug).where(Bug.id == bug_id))
    bug = result.scalar_one_or_none()

    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not current_user.is_admin and bug.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this bug")

    # Cascade delete from Azure DevOps if previously pushed
    if bug.external_id:
        try:
            from app.services.integrations.azure_devops import get_active_ado_config, AzureDevOpsClient
            ado_config = await get_active_ado_config(db)
            if ado_config and ado_config.get("org"):
                client = AzureDevOpsClient(
                    org=ado_config["org"],
                    pat=ado_config["pat"],
                    project=ado_config.get("project"),
                )
                await client.delete_work_item(bug.external_id)
        except Exception:
            pass

    bug_title = bug.title
    await db.delete(bug)
    await db.commit()

    await log_audit(db, current_user.id, current_user.email, "bug.delete",
                    entity_type="bug", entity_id=bug_id,
                    details={"title": bug_title})

    return {"message": "Bug deleted successfully"}


async def check_azure_devops_duplicates(db, request_description: str, request_title: str) -> List[SimilarBug]:
    """Check Azure DevOps for duplicate work items"""
    from app.services.integrations.azure_devops import get_active_ado_config

    similar = []

    try:
        ado_config = await get_active_ado_config(db)
        if not ado_config or not ado_config["org"]:
            return similar

        org = ado_config["org"]
        project = ado_config.get("project") or ""
        pat = ado_config["pat"]

        client = AzureDevOpsClient(org=org, pat=pat, project=project)

        work_items = await client.get_work_items(states=["New", "Active", "In Progress"])

        for item in work_items:
            item_title = item.get("title", "") or item.get("webUrl", "") or ""
            item_desc = item.get("description", "") or ""
            ext_id = str(item.get("id", ""))

            # Use combined title + description similarity for better accuracy
            similarity = calculate_combined_similarity(
                request_title, request_description, item_title, item_desc
            )
            if similarity > 0.35:
                project_path = f"{org}/{project}" if project else org
                similar.append(
                    SimilarBug(
                        id=None,
                        title=item_title,
                        description=item_desc[:200] if item_desc else "",
                        severity="",
                        type="",
                        status=item.get("state", ""),
                        source="azure_devops",
                        similarity=round(similarity, 3),
                        external_url=f"https://dev.azure.com/{project_path}/_workitems/edit/{ext_id}",
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
            item_title = fields.get("summary", "")
            ext_id = issue.get("key", "")
            status = fields.get("status", {}).get("name", "")
            
            # Extract JIRA description text
            item_desc = ""
            try:
                if fields.get("description"):
                    item_desc = fields["description"].get("content", [{}])[0].get("content", [{}])[0].get("text", "")
            except (IndexError, AttributeError, TypeError):
                item_desc = str(fields.get("description", "")) if fields.get("description") else ""
            
            # Use combined title + description similarity
            similarity = calculate_combined_similarity(
                request_title, request_description, item_title, item_desc
            )
            if similarity > 0.35:
                similar.append(
                    SimilarBug(
                        id=None,
                        title=item_title,
                        description=item_desc[:200] if item_desc else "",
                        severity="",
                        type="",
                        status=status,
                        source="jira",
                        similarity=round(similarity, 3),
                        external_url=f"{settings.JIRA_BASE_URL}/browse/{ext_id}",
                        external_id=ext_id,
                    )
                )
    except Exception:
        pass
    
    return similar


# Stop words to exclude from similarity comparisons
DUPLICATE_STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "it", "its", "i", "me", "my", "we", "our", "you", "your", "he",
    "she", "they", "them", "their", "what", "which", "who", "whom",
    "when", "where", "why", "how", "if", "because", "while", "although",
    "about", "up", "out", "off", "over", "under", "again", "further",
    "once", "here", "there", "am", "bug", "error", "issue", "problem",
}


def _extract_meaningful_words(text: str) -> set:
    """Extract meaningful words from text, removing stop words and short tokens."""
    import re
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    words = text.split()
    return {w for w in words if w not in DUPLICATE_STOP_WORDS and len(w) > 2}


def calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate text similarity based on meaningful word overlap (Jaccard with stop-word removal)."""
    if not text1 or not text2:
        return 0.0
    
    words1 = _extract_meaningful_words(text1)
    words2 = _extract_meaningful_words(text2)
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union) if union else 0.0


def calculate_combined_similarity(title1: str, desc1: str, title2: str, desc2: str) -> float:
    """Calculate weighted similarity using both title and description.
    
    Title similarity is weighted higher (0.6) because titles are more 
    discriminating for duplicate detection than full descriptions.
    """
    title_sim = calculate_text_similarity(title1, title2)
    desc_sim = calculate_text_similarity(desc1, desc2)
    return 0.6 * title_sim + 0.4 * desc_sim


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    request: DuplicateCheckRequest, db: AsyncSession = Depends(get_db)
):
    similar_bugs = []
    
    # Use BOTH title and description for embedding generation (more context = better matching)
    combined_text = f"{request.title}. {request.description}"
    embedding = await generate_embedding(combined_text)
    
    # --- Phase 1: Embedding-based similarity (most accurate) ---
    if embedding:
        query = select(Bug, BugEmbedding).join(BugEmbedding, Bug.id == BugEmbedding.bug_id)
        if request.omit_bug_id is not None:
            query = query.where(Bug.id != request.omit_bug_id)
        query = query.limit(50)

        result = await db.execute(query)
        rows = result.all()
        
        for bug, emb in rows:
            if emb is not None:
                emb_array = emb.embedding
                if emb_array is not None and len(emb_array) > 0:
                    emb_similarity = calculate_cosine_similarity(embedding, list(emb_array))
                    # Also calculate text similarity as a cross-check
                    text_sim = calculate_combined_similarity(
                        request.title, request.description,
                        bug.title, bug.description or ""
                    )
                    # Use the higher of the two scores
                    similarity = max(emb_similarity, text_sim)
                    if similarity > 0.4:
                        similar_bugs.append(
                            SimilarBug(
                                id=bug.id,
                                title=bug.title,
                                description=bug.description,
                                severity=bug.severity,
                                type=bug.type,
                                status=bug.status,
                                source=bug.source,
                                similarity=round(similarity, 3),
                            )
                        )
    
    # --- Phase 2: Text-based fallback (only if embeddings found nothing) ---
    if not similar_bugs:
        query = select(Bug)
        if request.omit_bug_id is not None:
            query = query.where(Bug.id != request.omit_bug_id)
        query = query.limit(50)

        result = await db.execute(query)
        bugs = result.scalars().all()

        for bug in bugs:
            # Calculate proper combined similarity instead of arbitrary scores
            similarity = calculate_combined_similarity(
                request.title, request.description,
                bug.title, bug.description or ""
            )
            if similarity > 0.35:
                similar_bugs.append(
                    SimilarBug(
                        id=bug.id,
                        title=bug.title,
                        description=bug.description,
                        severity=bug.severity,
                        type=bug.type,
                        status=bug.status,
                        source=bug.source,
                        similarity=round(similarity, 3),
                    )
                )

    # --- Phase 3: External sources (synced local cache) ---
    # Query external_issue_cache which has synced ADO bugs with embeddings
    if embedding:
        try:
            from sqlalchemy import text
            from app.services.integrations.azure_devops import get_active_ado_config

            ado_config = await get_active_ado_config(db)
            org = (ado_config or {}).get("org") if ado_config else None
            project = (ado_config or {}).get("project") if ado_config else None
            project_path = f"{org}/{project}" if org and project else (org or "")

            result = await db.execute(
                text("""
                    SELECT id, external_id, title, description, embedding, cached_at
                    FROM external_issue_cache
                    WHERE embedding IS NOT NULL AND integration_id = 1
                    LIMIT 50
                """)
            )
            rows = result.all()

            for row in rows:
                try:
                    emb_data = row[4]
                    if emb_data and len(emb_data) > 0:
                        emb_list = json.loads(emb_data)
                        ext_similarity = calculate_cosine_similarity(embedding, emb_list)

                        if ext_similarity > 0.35:
                            similar_bugs.append(
                                SimilarBug(
                                    id=None,
                                    title=row[2],
                                    description=row[3][:200] if row[3] else "",
                                    severity="",
                                    type="azure_devops",
                                    status="",
                                    source="azure_devops",
                                    similarity=round(ext_similarity, 3),
                                    external_url=f"https://dev.azure.com/{project_path}/_workitems/edit/{row[1]}" if org else None,
                                    external_id=str(row[1]),
                                )
                            )
                except Exception as e:
                    print(f"Error processing external bug {row[1]}: {e}")
        except Exception as e:
            print(f"Error checking external cache: {e}")
    
    # Sort by similarity and keep top 5
    similar_bugs.sort(key=lambda x: x.similarity, reverse=True)
    similar_bugs = similar_bugs[:5]
    
    # Filter out low-confidence matches (below 0.35 combined threshold)
    similar_bugs = [b for b in similar_bugs if b.similarity >= 0.35]

    # Only flag as duplicate if top match has high confidence
    is_duplicate = len(similar_bugs) > 0 and similar_bugs[0].similarity > 0.85

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
    current_user: Optional[User] = Depends(get_current_user_from_token),
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
        from app.services.integrations.azure_devops import get_active_ado_config, AzureDevOpsClient

        ado_config = await get_active_ado_config(db)
        if not ado_config or not ado_config["org"]:
            return PushBugResponse(
                success=False,
                message="Azure DevOps not configured in integrations",
            )

        org = ado_config["org"]
        pat = ado_config["pat"]

        # Get project name from bug's project_id, or fallback to env var default
        ado_project_name = project_key
        if bug.project_id and not ado_project_name:
            project_result = await db.execute(
                select(Project).where(Project.id == bug.project_id)
            )
            project = project_result.scalar_one_or_none()
            if project:
                ado_project_name = project.ado_project_name or project.name

        if not ado_project_name:
            ado_project_name = settings.AZURE_DEVOPS_PROJECT

        client = AzureDevOpsClient(org=org, pat=pat, project=ado_project_name)

        if bug.external_id:
            push_result = await client.update_work_item(
                external_id=bug.external_id,
                title=bug.title,
                description=bug.description,
                severity=bug.severity,
                bug_type=bug.type,
                priority_value=bug.priority,
                repro_steps=bug.repro_steps,
                expected_result=bug.expected_result,
                actual_result=bug.actual_result,
                attachments=bug.attachments,
                assigned_to=bug.assigned_to,
                duplicate_of_external_ids=bug.duplicate_of_external_ids,
                duplicate_justification=bug.duplicate_justification,
                project=ado_project_name,
            )
        else:
            push_result = await client.create_work_item(
                title=bug.title,
                description=bug.description,
                severity=bug.severity,
                bug_type=bug.type,
                priority_value=bug.priority,
                repro_steps=bug.repro_steps,
                expected_result=bug.expected_result,
                actual_result=bug.actual_result,
                attachments=bug.attachments,
                assigned_to=bug.assigned_to,
                duplicate_of_external_ids=bug.duplicate_of_external_ids,
                duplicate_justification=bug.duplicate_justification,
                project=ado_project_name,
            )

        if push_result.get("success"):
            bug.push_to_external = True
            if push_result.get("external_id"):
                bug.external_id = push_result["external_id"]
            bug.updated_at = datetime.utcnow()
            await db.commit()

            if current_user:
                await log_audit(db, current_user.id, current_user.email, "bug.push",
                                entity_type="bug", entity_id=bug.id,
                                details={"title": bug.title, "external_id": bug.external_id,
                                         "tool": tool_type})

        return PushBugResponse(**push_result)
    
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