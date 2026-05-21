"""
MCP Server for Bug Triage - Duplicate Hunter
Provides tools for OpenCode to search for duplicate bugs
"""

import os
import sys
import hashlib
from typing import Optional, List, Any
from dataclasses import dataclass
import json
import base64
import asyncio

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Installing mcp...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "mcp"], check=True)
    from mcp.server.fastmcp import FastMCP

import httpx

from app.services.duplicate_detection import (
    build_search_terms,
    calculate_duplicate_similarity,
    coerce_embedding,
)

# ============================================================================
# Configuration
# ============================================================================

@dataclass
class Config:
    # Azure DevOps
    ado_org: str
    ado_project: str
    ado_pat: str
    
    # Database
    db_url: str
    
    # Groq (for embeddings)
    groq_api_key: str
    
    # JWT
    jwt_secret: str
    
    @classmethod
    def from_env(cls):
        return cls(
            ado_org=os.getenv("AZURE_DEVOPS_ORG", "suriyaganesh894"),
            ado_project=os.getenv("AZURE_DEVOPS_PROJECT", "AiBugTriage"),
            ado_pat=os.getenv("ADO_PAT", ""),
            db_url=os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/bug_triage"),
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            jwt_secret=os.getenv("SECRET_KEY", "your-secret-key"),
        )

def get_config():
    """Get config from environment - call this for dynamic updates"""
    return Config(
        ado_org=os.getenv("AZURE_DEVOPS_ORG", "suriyaganesh894"),
        ado_project=os.getenv("AZURE_DEVOPS_PROJECT", "AiBugTriage"),
        ado_pat=os.getenv("ADO_PAT", ""),
        db_url=os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/bug_triage"),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
        jwt_secret=os.getenv("SECRET_KEY", "your-secret-key"),
    )

# Initial config (can be overridden)
config = get_config()

# ============================================================================
# MCP Server Initialization
# ============================================================================

mcp = FastMCP("BugTriage-DuplicateHunter", json_response=True)

# ============================================================================
# Embedding Generation (all-MiniLM-L6-v2)
# ============================================================================

def generate_embedding(text: str) -> List[float]:
    """Generate semantic embedding using all-MiniLM-L6-v2."""
    from app.services.ai.embedding_service import generate_embedding as gen_emb
    result = gen_emb(text)
    if result is None:
        return [0.0] * 384
    return result


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    from app.services.ai.embedding_service import cosine_similarity as cos_sim
    return cos_sim(a, b)


MCP_STOP_WORDS = {
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


def text_similarity(text1: str, text2: str) -> float:
    """Text similarity based on meaningful word overlap (Jaccard with stop-word removal)."""
    import re
    text1 = re.sub(r'[^a-zA-Z0-9\s]', ' ', text1.lower())
    text2 = re.sub(r'[^a-zA-Z0-9\s]', ' ', text2.lower())
    words1 = {w for w in text1.split() if w not in MCP_STOP_WORDS and len(w) > 2}
    words2 = {w for w in text2.split() if w not in MCP_STOP_WORDS and len(w) > 2}
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)


# ============================================================================
# MCP Tools
# ============================================================================

@mcp.tool()
async def search_local_db(
    description: str,
    min_similarity: float = 0.7,
    limit: int = 10,
    title: str = "",
    repro_steps: str = ""
) -> dict:
    """
    Search local database for duplicate bugs using semantic embedding.
    
    Args:
        description: Bug description to search
        min_similarity: Minimum similarity threshold (0.0-1.0), default 0.7
        limit: Maximum number of results, default 10
    
    Returns:
        List of similar bugs with similarity scores
    """
    try:
        import asyncpg
        
        # Extract DB credentials from URL
        db_url = config.db_url
        # Format: postgresql+asyncpg://user:pass@host:port/db
        db_url_clean = db_url.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
        
        parts = db_url_clean.split("@")
        user_pass = parts[0].split(":")
        host_db = parts[1].split("/")
        host_port = host_db[0].split(":")
        
        user = user_pass[0]
        password = user_pass[1]
        host = host_port[0]
        port = int(host_port[1]) if len(host_port) > 1 else 5432
        database = host_db[1] if len(host_db) > 1 else "bug_triage"
        
        conn = await asyncpg.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        
        # Generate embedding from all available request context.
        query_text = " ".join(part for part in [title, description, repro_steps] if part)
        embedding = generate_embedding(query_text or description)
        
        # Query bugs with embeddings
        rows = await conn.fetch("""
            SELECT b.id, b.title, b.description, b.severity, b.type, b.status, 
                   be.embedding
            FROM bugs b
            LEFT JOIN bug_embeddings be ON b.id = be.bug_id
            WHERE be.embedding IS NOT NULL
            LIMIT 100
        """)
        
        similar_bugs = []
        for row in rows:
            candidate_embedding = coerce_embedding(row['embedding'])
            similarity = calculate_duplicate_similarity(
                title,
                description,
                row['title'] or "",
                row['description'] or "",
                request_repro_steps=repro_steps,
                candidate_embedding=candidate_embedding,
                request_embedding=embedding,
            )
            if similarity >= min_similarity:
                similar_bugs.append({
                    "id": row['id'],
                    "title": row['title'],
                    "description": row['description'][:200] + "..." if row['description'] and len(row['description']) > 200 else row['description'],
                    "severity": row['severity'],
                    "type": row['type'],
                    "status": row['status'],
                    "similarity": round(similarity, 3),
                    "source": "local_db"
                })

        if not similar_bugs:
            fallback_rows = await conn.fetch("""
                SELECT id, title, description, severity, type, status
                FROM bugs
                ORDER BY updated_at DESC
                LIMIT 100
            """)

            for row in fallback_rows:
                similarity = calculate_duplicate_similarity(
                    title,
                    description,
                    row['title'] or "",
                    row['description'] or "",
                    request_repro_steps=repro_steps,
                    request_embedding=embedding,
                )
                if similarity >= min_similarity:
                    similar_bugs.append({
                        "id": row['id'],
                        "title": row['title'],
                        "description": row['description'][:200] + "..." if row['description'] and len(row['description']) > 200 else row['description'],
                        "severity": row['severity'],
                        "type": row['type'],
                        "status": row['status'],
                        "similarity": round(similarity, 3),
                        "source": "local_db"
                    })
        
        await conn.close()
        
        # Sort by similarity
        similar_bugs.sort(key=lambda x: x['similarity'], reverse=True)
        return {"results": similar_bugs[:limit], "total": len(similar_bugs)}
        
    except Exception as e:
        return {"error": str(e), "results": []}


@mcp.tool()
async def search_ado_duplicates(
    description: str,
    title: str = "",
    min_similarity: float = 0.5,
    repro_steps: str = ""
) -> dict:
    """
    Search Azure DevOps for duplicate work items using WIQL.
    
    Args:
        description: Bug description to search
        title: Bug title (more targeted search)
        min_similarity: Minimum similarity threshold, default 0.5
    
    Returns:
        List of similar work items from ADO
    """
    # Get fresh config for each call
    cfg = get_config()
    if not cfg.ado_org or not cfg.ado_project or not cfg.ado_pat:
        return {"error": "Azure DevOps not configured", "results": []}
    
    try:
        # Auth
        auth = base64.b64encode(f":{config.ado_pat}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json"
        }
        
        base_url = f"https://dev.azure.com/{config.ado_org}/{config.ado_project}"
        
        # Build WIQL query from the same normalized tokens used for scoring.
        keywords = build_search_terms(title, description, repro_steps, limit=5)
        
        if not keywords:
            return {"results": [], "message": "No valid keywords for search"}
        
        keyword_filter = " OR ".join([f"[System.Title] CONTAINS '{w}'" for w in keywords])
        
        wiql = f"""
            SELECT [System.Id], [System.Title], [System.Description], [System.State], [System.WorkItemType]
            FROM WorkItems
            WHERE [System.WorkItemType] = 'Bug' AND ({keyword_filter})
            ORDER BY [System.Id] DESC
        """
        
        similar_items = []
        request_embedding = generate_embedding(f"{title} {description} {repro_steps}".strip())

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/_apis/wit/wiql?api-version=7.0",
                json={"query": wiql},
                headers=headers,
                timeout=30.0
            )
        
            if response.status_code != 200:
                return {"error": f"ADO API error: {response.status_code}", "results": []}
            
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
                item_desc = fields.get("System.Description", "") or ""
                item_state = fields.get("System.State", "") or ""
                item_type = fields.get("System.WorkItemType", "") or ""

                sim = calculate_duplicate_similarity(
                    title,
                    description,
                    item_title,
                    item_desc,
                    request_repro_steps=repro_steps,
                    request_embedding=request_embedding,
                )

                if sim >= min_similarity:
                    similar_items.append({
                        "id": item_id,
                        "title": item_title,
                        "description": item_desc[:200] + "..." if len(item_desc) > 200 else item_desc,
                        "state": item_state,
                        "work_item_type": item_type,
                        "similarity": round(sim, 3),
                        "source": "azure_devops",
                        "url": f"https://dev.azure.com/{config.ado_org}/{config.ado_project}/_workitems/edit/{item_id}"
                    })
        
        similar_items.sort(key=lambda x: x['similarity'], reverse=True)
        return {"results": similar_items[:10], "total": len(similar_items)}
        
    except Exception as e:
        return {"error": str(e), "results": []}


@mcp.tool()
async def check_duplicates(
    title: str,
    description: str,
    min_similarity: float = 0.7,
    repro_steps: str = ""
) -> dict:
    """
    Check for duplicates across both local DB and Azure DevOps.
    This is the main duplicate detection tool.
    
    Args:
        title: Bug title
        description: Detailed bug description
        min_similarity: Minimum similarity threshold, default 0.7
    
    Returns:
        Combined results from local DB and ADO with similarity scores
    """
    # Search both sources in parallel
    local_results, ado_results = await asyncio.gather(
        search_local_db(description, min_similarity, title=title, repro_steps=repro_steps),
        search_ado_duplicates(description, title, min_similarity, repro_steps=repro_steps)
    )
    
    # Combine and sort
    all_results = []
    
    for r in local_results.get("results", []):
        r["match_type"] = "local_db"
        all_results.append(r)
    
    for r in ado_results.get("results", []):
        r["match_type"] = "azure_devops"
        all_results.append(r)
    
    all_results.sort(key=lambda x: x["similarity"], reverse=True)
    
    is_duplicate = len(all_results) > 0 and all_results[0]["similarity"] >= 0.82
    
    return {
        "is_duplicate": is_duplicate,
        "similarity_threshold": min_similarity,
        "results": all_results[:10],
        "local_db_count": len(local_results.get("results", [])),
        "ado_count": len(ado_results.get("results", [])),
        "message": f"Potential duplicate found! Similarity: {all_results[0]['similarity']}" if is_duplicate else "No duplicates found above threshold"
    }


@mcp.tool()
async def get_bug_details(bug_id: int) -> dict:
    """
    Get detailed information about a specific bug from local database.
    
    Args:
        bug_id: The bug ID to retrieve
    """
    try:
        import asyncpg
        
        db_url = config.db_url
        db_url_clean = db_url.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
        parts = db_url_clean.split("@")
        user_pass = parts[0].split(":")
        host_db = parts[1].split("/")
        host_port = host_db[0].split(":")
        
        user = user_pass[0]
        password = user_pass[1]
        host = host_port[0]
        port = int(host_port[1]) if len(host_port) > 1 else 5432
        database = host_db[1] if len(host_db) > 1 else "bug_triage"
        
        conn = await asyncpg.connect(host=host, port=port, database=database, user=user, password=password)
        
        row = await conn.fetchrow("SELECT * FROM bugs WHERE id = $1", bug_id)
        await conn.close()
        
        if row:
            return dict(row)
        return {"error": "Bug not found"}
        
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
async def list_recent_bugs(limit: int = 10) -> dict:
    """
    List recent bugs from local database.
    
    Args:
        limit: Number of recent bugs to return, default 10
    """
    try:
        import asyncpg
        
        db_url = config.db_url
        db_url_clean = db_url.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
        parts = db_url_clean.split("@")
        user_pass = parts[0].split(":")
        host_db = parts[1].split("/")
        host_port = host_db[0].split(":")
        
        user = user_pass[0]
        password = user_pass[1]
        host = host_port[0]
        port = int(host_port[1]) if len(host_port) > 1 else 5432
        database = host_db[1] if len(host_db) > 1 else "bug_triage"
        
        conn = await asyncpg.connect(host=host, port=port, database=database, user=user, password=password)
        
        rows = await conn.fetch("""
            SELECT id, title, severity, type, status, created_at
            FROM bugs
            ORDER BY created_at DESC
            LIMIT $1
        """, limit)
        
        await conn.close()
        
        return {"bugs": [dict(r) for r in rows], "count": len(rows)}
        
    except Exception as e:
        return {"error": str(e), "bugs": []}


@mcp.tool()
async def sync_ado_to_local(limit: int = 100) -> dict:
    """
    Sync recent work items from Azure DevOps to local database.
    This updates the local database with latest ADO bugs for embedding search.
    
    Args:
        limit: Maximum number of work items to sync, default 100
    """
    try:
        from app.services.sync_service import SyncService
        service = SyncService()
        result = await service.sync_ado_bugs()

        return {
            "synced": result.get("synced", 0),
            "updated": result.get("updated", 0),
            "comments_synced": result.get("comments_synced", 0),
            "errors": result.get("errors", 0),
            "message": f"Synced {result.get('synced', 0)} new, updated {result.get('updated', 0)} bugs from ADO",
        }

    except Exception as e:
        return {"error": str(e), "synced": 0}


# ============================================================================
# MCP Resources
# ============================================================================

@mcp.resource("schema://main")
def get_database_schema() -> str:
    """Provide the database schema for reference"""
    return """
    Table: bugs
    - id (int, PK)
    - title (string)
    - description (text)
    - priority (string: critical/high/medium/low)
    - severity (string: critical/high/medium/low)
    - type (string: ui/api/functional/performance/security/other)
    - status (string: open/in_progress/resolved/closed)
    - source (string: internal/azure_devops/jira)
    - external_id (string, nullable)
    - repro_steps (text, nullable)
    - expected_result (text, nullable)
    - actual_result (text, nullable)
    - attachments (json, nullable)
    - assigned_to (string, nullable)
    - created_by (string, nullable)
    - created_at (datetime)
    - updated_at (datetime)

    Table: bug_embeddings
    - id (int, PK)
    - bug_id (int, FK)
    - embedding (vector[384])
    - created_at (datetime)

    Table: analysis_results
    - id (int, PK)
    - bug_id (int, FK)
    - root_causes (jsonb)
    - confidence_scores (jsonb)
    - analyzed_at (datetime)

    Table: bug_comments
    - id (int, PK)
    - bug_id (int, FK)
    - external_comment_id (string)
    - author (string)
    - body (text)
    - created_at (datetime)
    - updated_at (datetime)

    Table: sync_state
    - id (int, PK)
    - bug_id (int, FK, unique)
    - external_id (string)
    - last_synced_at (datetime)
    - external_updated_at (datetime)
    - status (string: pending/in_sync/conflict)
    """


@mcp.resource("config://ado")
def get_ado_config() -> str:
    """Provide Azure DevOps configuration info"""
    return f"""
    Organization: {config.ado_org}
    Project: {config.ado_project}
    PAT Configured: {'Yes' if config.ado_pat else 'No'}
    """


# ============================================================================
# MCP Prompts
# ============================================================================

@mcp.prompt()
def analyze_bug_prompt(bug_description: str) -> str:
    """Generate a prompt for analyzing a bug"""
    return f"""
    Analyze this bug report and determine:
    1. Is this a duplicate? (check using the tools)
    2. What is the likely root cause?
    3. What priority should it be?
    4. What type of bug is this?
    
    Bug Report:
    {bug_description}
    """


# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    print("Starting BugTriage MCP Server...")
    print(f"ADO Org: {config.ado_org}")
    print(f"ADO Project: {config.ado_project}")
    print(f"DB: {config.db_url.split('@')[1] if '@' in config.db_url else 'configured'}")
    
    # Run with stdio transport for local development
    mcp.run(transport="stdio")
