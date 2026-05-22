from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List, Optional, Sequence, Tuple
import json
import re

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import DuplicateCheckRequest, DuplicateCheckResponse, SimilarBug


STOP_WORDS = {
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

DEFAULT_VISIBLE_THRESHOLD = 0.35
DEFAULT_DUPLICATE_THRESHOLD = 0.82
DEFAULT_MAX_RESULTS = 5
DEFAULT_CANDIDATE_LIMIT = 150


@dataclass
class DuplicateCandidate:
    id: Optional[int]
    title: str
    description: str
    severity: str
    type: str
    status: str
    source: str
    embedding: Optional[Sequence[float]] = None
    external_url: Optional[str] = None
    external_id: Optional[str] = None
    repro_steps: Optional[str] = None

    def key(self) -> str:
        if self.source == "azure_devops" and self.external_id:
            return f"azure_devops:{self.external_id}"
        if self.id is not None:
            return f"{self.source}:{self.id}"
        title = normalize_text(self.title)
        desc = normalize_text(self.description)[:80]
        return f"{self.source}:{title}:{desc}"


def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    # Strip HTML tags to prevent formatting keywords (b, li, ul, etc.) from polluting Jaccard index
    text_clean = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text_clean.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_meaningful_words(text: Optional[str]) -> set[str]:
    normalized = normalize_text(text)
    if not normalized:
        return set()
    return {word for word in normalized.split() if word not in STOP_WORDS and len(word) > 2}


def build_search_terms(*parts: Optional[str], limit: int = 6) -> List[str]:
    words = []
    for part in parts:
        words.extend(extract_meaningful_words(part))
    # Prefer longer tokens, then stable alphabetical order for deterministic queries.
    ranked = sorted(set(words), key=lambda token: (-len(token), token))
    return ranked[:limit]


def coerce_embedding(raw_embedding: Any) -> Optional[List[float]]:
    if raw_embedding is None:
        return None
    if isinstance(raw_embedding, list):
        return [float(value) for value in raw_embedding]
    if isinstance(raw_embedding, tuple):
        return [float(value) for value in raw_embedding]
    if hasattr(raw_embedding, "tolist"):
        return [float(value) for value in raw_embedding.tolist()]
    if isinstance(raw_embedding, memoryview):
        try:
            return [float(value) for value in json.loads(raw_embedding.tobytes().decode())]
        except Exception:
            return None
    if isinstance(raw_embedding, str):
        try:
            parsed = json.loads(raw_embedding)
            if isinstance(parsed, list):
                return [float(value) for value in parsed]
        except Exception:
            return None
    return None


def calculate_cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b:
        return 0.0

    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = sum(x * x for x in a) ** 0.5
    magnitude_b = sum(y * y for y in b) ** 0.5

    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0

    return dot_product / (magnitude_a * magnitude_b)


def calculate_text_similarity(text1: Optional[str], text2: Optional[str]) -> float:
    if not text1 or not text2:
        return 0.0

    words1 = extract_meaningful_words(text1)
    words2 = extract_meaningful_words(text2)
    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union) if union else 0.0


def calculate_combined_similarity(
    title1: str,
    desc1: str,
    title2: str,
    desc2: str,
    repro1: Optional[str] = None,
    repro2: Optional[str] = None,
) -> float:
    title_sim = calculate_text_similarity(title1, title2)
    desc_sim = calculate_text_similarity(desc1, desc2)
    repro_sim = calculate_text_similarity(repro1, repro2)
    return (0.50 * title_sim) + (0.35 * desc_sim) + (0.15 * repro_sim)


def calculate_duplicate_similarity(
    request_title: str,
    request_description: str,
    candidate_title: str,
    candidate_description: str,
    *,
    request_repro_steps: Optional[str] = None,
    candidate_repro_steps: Optional[str] = None,
    request_embedding: Optional[Sequence[float]] = None,
    candidate_embedding: Optional[Sequence[float]] = None,
) -> float:
    lexical_similarity = calculate_combined_similarity(
        request_title,
        request_description,
        candidate_title,
        candidate_description,
        request_repro_steps,
        candidate_repro_steps,
    )

    score = lexical_similarity
    if request_embedding and candidate_embedding:
        embedding_similarity = calculate_cosine_similarity(request_embedding, candidate_embedding)
        score = (0.62 * embedding_similarity) + (0.38 * lexical_similarity)
    elif request_embedding or candidate_embedding:
        # When only one embedding is available, fall back to lexical similarity.
        score = lexical_similarity

    normalized_request_title = normalize_text(request_title)
    normalized_candidate_title = normalize_text(candidate_title)
    if normalized_request_title and normalized_request_title == normalized_candidate_title:
        score += 0.08
    elif normalized_request_title and normalized_candidate_title and (
        normalized_request_title in normalized_candidate_title
        or normalized_candidate_title in normalized_request_title
    ):
        score += 0.04

    if request_repro_steps and candidate_repro_steps:
        repro_overlap = calculate_text_similarity(request_repro_steps, candidate_repro_steps)
        if repro_overlap >= 0.6:
            score += 0.05

    if calculate_text_similarity(request_title, candidate_title) >= 0.85 and calculate_text_similarity(
        request_description, candidate_description
    ) >= 0.5:
        score += 0.03

    return max(0.0, min(1.0, score))


def _candidate_to_bug_response(candidate: DuplicateCandidate, similarity: float) -> SimilarBug:
    return SimilarBug(
        id=candidate.id,
        title=candidate.title,
        description=(candidate.description or "")[:200],
        severity=candidate.severity,
        type=candidate.type,
        status=candidate.status,
        source=candidate.source,
        similarity=round(similarity, 3),
        external_url=candidate.external_url,
        external_id=candidate.external_id,
    )


def rank_duplicate_candidates(
    request: DuplicateCheckRequest,
    candidates: Iterable[DuplicateCandidate],
    *,
    request_embedding: Optional[Sequence[float]] = None,
    visible_threshold: float = DEFAULT_VISIBLE_THRESHOLD,
    duplicate_threshold: float = DEFAULT_DUPLICATE_THRESHOLD,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> DuplicateCheckResponse:
    ranked: List[Tuple[float, DuplicateCandidate]] = []
    for candidate in candidates:
        similarity = calculate_duplicate_similarity(
            request.title,
            request.description,
            candidate.title,
            candidate.description,
            request_repro_steps=request.repro_steps,
            candidate_repro_steps=candidate.repro_steps,
            request_embedding=request_embedding,
            candidate_embedding=candidate.embedding,
        )
        if similarity >= visible_threshold:
            ranked.append((similarity, candidate))

    ranked.sort(key=lambda item: item[0], reverse=True)

    # Group candidates by their logical bug identity to avoid duplicate local vs ADO entries.
    grouped: dict[str, Tuple[float, DuplicateCandidate]] = {}
    for similarity, candidate in ranked:
        if candidate.external_id:
            logical_id = f"ext:{candidate.external_id}"
        elif candidate.id is not None:
            logical_id = f"local:{candidate.id}"
        else:
            logical_id = f"raw:{normalize_text(candidate.title)}"

        if logical_id in grouped:
            prev_sim, prev_cand = grouped[logical_id]
            # Prefer source == "azure_devops" (ADO candidate) if available.
            if candidate.source == "azure_devops" and prev_cand.source != "azure_devops":
                keep_cand = candidate
            elif prev_cand.source == "azure_devops" and candidate.source != "azure_devops":
                keep_cand = prev_cand
            else:
                keep_cand = candidate if similarity > prev_sim else prev_cand
            grouped[logical_id] = (max(prev_sim, similarity), keep_cand)
        else:
            grouped[logical_id] = (similarity, candidate)

    # Sort the unique grouped candidates by similarity descending
    unique_ranked = sorted(grouped.values(), key=lambda item: item[0], reverse=True)

    similar_bugs: List[SimilarBug] = []
    for similarity, candidate in unique_ranked:
        similar_bugs.append(_candidate_to_bug_response(candidate, similarity))
        if len(similar_bugs) >= max_results:
            break

    top_score = similar_bugs[0].similarity if similar_bugs else 0.0
    is_duplicate = bool(similar_bugs and top_score >= duplicate_threshold)

    return DuplicateCheckResponse(
        is_duplicate=is_duplicate,
        similar_bugs=similar_bugs,
        message="Potential duplicates found" if similar_bugs else "No duplicates found",
    )


async def _fetch_active_ado_integration_ids(db: AsyncSession) -> List[int]:
    from app.core.database import Integration

    result = await db.execute(
        select(Integration.id).where(
            Integration.tool_type == "azure_devops",
            Integration.is_active.is_(True),
        )
    )
    return [integration_id for integration_id in result.scalars().all() if integration_id is not None]


async def _fetch_local_candidates(db: AsyncSession, request: DuplicateCheckRequest) -> List[DuplicateCandidate]:
    from app.core.database import Bug, BugEmbedding

    search_terms = build_search_terms(request.title, request.description, request.repro_steps)
    candidates: List[DuplicateCandidate] = []
    seen: set[int] = set()

    async def load(query):
        result = await db.execute(query)
        for bug, embedding in result.all():
            if bug.id in seen:
                continue
            seen.add(bug.id)
            candidates.append(
                DuplicateCandidate(
                    id=bug.id,
                    title=bug.title,
                    description=bug.description or "",
                    severity=bug.severity or "",
                    type=bug.type or "",
                    status=bug.status or "",
                    source=bug.source or "internal",
                    external_id=str(bug.external_id) if bug.external_id else None,
                    embedding=coerce_embedding(getattr(embedding, "embedding", None) if embedding else None),
                    repro_steps=bug.repro_steps,
                )
            )

    base_query = select(Bug, BugEmbedding).outerjoin(BugEmbedding, Bug.id == BugEmbedding.bug_id)
    if request.omit_bug_id is not None:
        base_query = base_query.where(Bug.id != request.omit_bug_id)

    if search_terms:
        keyword_filters = [
            or_(
                Bug.title.ilike(f"%{term}%"),
                Bug.description.ilike(f"%{term}%"),
                Bug.repro_steps.ilike(f"%{term}%"),
            )
            for term in search_terms
        ]
        await load(base_query.where(or_(*keyword_filters)).order_by(Bug.updated_at.desc()).limit(DEFAULT_CANDIDATE_LIMIT))

    if len(candidates) < 10:
        await load(base_query.order_by(Bug.updated_at.desc()).limit(DEFAULT_CANDIDATE_LIMIT))

    return candidates


async def _fetch_external_candidates(db: AsyncSession, request: DuplicateCheckRequest) -> List[DuplicateCandidate]:
    from app.core.database import ExternalIssueCache

    integration_ids = await _fetch_active_ado_integration_ids(db)
    if not integration_ids:
        return []

    search_terms = build_search_terms(request.title, request.description, request.repro_steps)
    query = select(ExternalIssueCache).where(ExternalIssueCache.integration_id.in_(integration_ids))
    if search_terms:
        keyword_filters = [
            or_(
                ExternalIssueCache.title.ilike(f"%{term}%"),
                ExternalIssueCache.description.ilike(f"%{term}%"),
            )
            for term in search_terms
        ]
        query = query.where(or_(*keyword_filters))

    query = query.order_by(ExternalIssueCache.cached_at.desc()).limit(DEFAULT_CANDIDATE_LIMIT)
    result = await db.execute(query)
    rows = result.scalars().all()

    from app.services.integrations.field_mapping import parse_ado_description

    candidates: List[DuplicateCandidate] = []
    for row in rows:
        parsed = parse_ado_description(row.description or "")
        candidates.append(
            DuplicateCandidate(
                id=None,
                title=row.title or "",
                description=parsed.get("description") or "",
                severity="",
                type="azure_devops",
                status="",
                source="azure_devops",
                embedding=coerce_embedding(row.embedding),
                external_id=str(row.external_id),
                repro_steps=parsed.get("repro_steps") or None,
            )
        )

    return candidates


async def _fetch_ado_direct_candidates(db: AsyncSession, request: DuplicateCheckRequest) -> List[DuplicateCandidate]:
    from app.services.integrations.azure_devops import get_active_ado_config

    ado_config = await get_active_ado_config(db)
    if not ado_config or not ado_config.get("org") or not ado_config.get("pat"):
        return []

    import base64
    import httpx

    auth = base64.b64encode(f":{ado_config['pat']}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json",
    }

    org = ado_config["org"]
    project = ado_config.get("project", "")
    base_url = f"https://dev.azure.com/{org}"
    if project:
        base_url = f"{base_url}/{project}"

    keywords = build_search_terms(request.title, request.description, request.repro_steps, limit=5)
    if not keywords:
        return []

    keyword_filter = " OR ".join([f"[System.Title] CONTAINS '{w}'" for w in keywords])
    wiql = f"""
        SELECT [System.Id], [System.Title], [System.Description], [System.State], [System.WorkItemType]
        FROM WorkItems
        WHERE [System.WorkItemType] = 'Bug' AND ({keyword_filter})
        ORDER BY [System.Id] DESC
    """

    candidates: List[DuplicateCandidate] = []
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/_apis/wit/wiql?api-version=7.0",
                json={"query": wiql},
                headers=headers,
                timeout=30.0,
            )
            if response.status_code != 200:
                return []

            work_items = response.json().get("workItems", [])
            for item in work_items[:20]:
                item_id = item.get("id")
                if not item_id:
                    continue

                detail_resp = await client.get(
                    f"{base_url}/_apis/wit/workitems/{item_id}?$expand=all&api-version=7.0",
                    headers=headers,
                    timeout=30.0,
                )
                if detail_resp.status_code != 200:
                    continue

                details = detail_resp.json()
                fields = details.get("fields", {})
                item_title = fields.get("System.Title", "") or ""
                item_desc_raw = fields.get("System.Description", "") or ""
                item_state = fields.get("System.State", "") or ""

                from app.services.integrations.field_mapping import parse_ado_description

                parsed = parse_ado_description(item_desc_raw)
                candidates.append(
                    DuplicateCandidate(
                        id=None,
                        title=item_title,
                        description=parsed.get("description") or "",
                        severity="",
                        type="",
                        status=item_state,
                        source="azure_devops",
                        external_id=str(item_id),
                        external_url=f"https://dev.azure.com/{org}/{project}/_workitems/edit/{item_id}",
                        repro_steps=parsed.get("repro_steps") or None,
                    )
                )
    except Exception:
        return []

    return candidates


async def find_duplicate_matches(
    db: AsyncSession,
    request: DuplicateCheckRequest,
) -> DuplicateCheckResponse:
    from app.services.ai import generate_embedding

    request_embedding = await generate_embedding(
        " ".join(part for part in [request.title, request.description, request.repro_steps] if part)
    )

    local_candidates = await _fetch_local_candidates(db, request)
    external_candidates = await _fetch_external_candidates(db, request)
    ado_direct_candidates = await _fetch_ado_direct_candidates(db, request)

    return rank_duplicate_candidates(
        request,
        [*local_candidates, *external_candidates, *ado_direct_candidates],
        request_embedding=request_embedding,
    )
