import asyncio
import os
import sys
import asyncpg
from datetime import datetime
from typing import Optional, Dict, Any
from urllib.parse import urlparse

sys.path.insert(0, "/app")
os.chdir("/app")

from app.services.ai.embedding_service import generate_embedding
from app.core.config import settings


class SyncService:
    def __init__(self):
        self._sync_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def sync_ado_bugs(self) -> Dict[str, Any]:
        import httpx
        import base64
        
        result = {
            "synced": 0,
            "updated": 0,
            "errors": 0,
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            from app.core.config import decrypt_api_key
            pat = settings.AZURE_DEVOPS_PAT
            if pat.startswith("ENC:"):
                pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)
            
            if not pat or not settings.AZURE_DEVOPS_ORG:
                return {"error": "Azure not configured", **result}
            
            org = settings.AZURE_DEVOPS_ORG
            project = settings.AZURE_DEVOPS_PROJECT
            base_url = f"https://dev.azure.com/{org}/{project}"
            
            auth = base64.b64encode(f":{pat}".encode()).decode()
            headers = {
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/json"
            }
            
            wiql_query = "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' ORDER BY [System.Id] DESC"
            
            async with httpx.AsyncClient() as http_client:
                wi_response = await http_client.post(
                    f"{base_url}/_apis/wit/wiql?api-version=7.0",
                    json={"query": wiql_query},
                    headers=headers,
                    timeout=30.0
                )
                
                if wi_response.status_code != 200:
                    return {"error": f"WIQL error: {wi_response.status_code}", **result}
                
                wi_data = wi_response.json()
                work_items_list = wi_data.get("workItems", [])[:50]
                
                db_url = settings.DATABASE_URL
                parsed = urlparse(db_url.replace("+asyncpg", ""))
                
                fetched = 0
                for wi in work_items_list:
                    if fetched >= 50:
                        break
                    
                    try:
                        work_item_id = wi.get("id")
                        work_item_url = wi.get("url")
                        
                        if not work_item_url:
                            continue
                        
                        detail_response = await http_client.get(
                            f"{work_item_url}?api-version=7.0",
                            headers=headers,
                            timeout=15.0
                        )
                        
                        if detail_response.status_code != 200:
                            continue
                        
                        wi_fields = detail_response.json().get("fields", {})
                        
                        external_id = str(work_item_id)
                        title = wi_fields.get("System.Title", "") or ""
                        description = wi_fields.get("System.Description", "") or ""
                        combined_text = f"{title} {description}".strip()[:1000] or "unknown"
                        
                        embedding = generate_embedding(combined_text)
                        
                        if embedding:
                            emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
                            
                            conn = await asyncpg.connect(
                                host=parsed.hostname,
                                port=parsed.port or 5432,
                                user=parsed.username,
                                password=parsed.password,
                                database=parsed.path.lstrip("/"),
                            )
                            
                            try:
                                existing = await conn.fetchval(
                                    "SELECT id FROM external_issue_cache WHERE external_id = $1 AND integration_id = 1",
                                    external_id
                                )
                                
                                if existing:
                                    await conn.execute(
                                        "UPDATE external_issue_cache SET title = $1, description = $2, embedding = $3::vector, cached_at = NOW() WHERE external_id = $4 AND integration_id = 1",
                                        title, description[:5000], emb_str, external_id
                                    )
                                    result["updated"] += 1
                                else:
                                    await conn.execute(
                                        "INSERT INTO external_issue_cache (integration_id, external_id, title, description, embedding, cached_at) VALUES (1, $1, $2, $3, $4::vector, NOW())",
                                        external_id, title, description[:5000], emb_str
                                    )
                                    result["synced"] += 1
                            finally:
                                await conn.close()
                            
                            fetched += 1
                            
                    except Exception as e:
                        print(f"Error syncing bug {work_item_id}: {e}")
                        result["errors"] += 1
                
        except Exception as e:
            return {"error": str(e), **result}
        
        result["completed_at"] = datetime.utcnow().isoformat()
        result["fetched"] = result["synced"] + result["updated"]
        return result
    
    async def _sync_loop(self):
        while self._running:
            try:
                await self.sync_ado_bugs()
            except Exception as e:
                print(f"Sync error: {e}")
            
            interval_minutes = getattr(settings, 'SYNC_INTERVAL_MINUTES', 15)
            
            if interval_minutes <= 0:
                self._running = False
                break
            
            await asyncio.sleep(interval_minutes * 60)
    
    async def start_scheduler(self):
        if self._running:
            return {"status": "already running"}
        
        self._running = True
        self._sync_task = asyncio.create_task(self._sync_loop())
        
        interval_minutes = getattr(settings, 'SYNC_INTERVAL_MINUTES', 15)
        return {
            "status": "started", 
            "interval_minutes": interval_minutes,
            "next_sync_in_seconds": interval_minutes * 60
        }
    
    async def stop_scheduler(self):
        self._running = False
        if self._sync_task:
            self._sync_task.cancel()
            try:
                await self._sync_task
            except asyncio.CancelledError:
                pass
        return {"status": "stopped"}
    
    def is_running(self) -> bool:
        return self._running


_sync_service = SyncService()


async def get_sync_status() -> Dict[str, Any]:
    is_running = _sync_service.is_running()
    interval_minutes = getattr(settings, 'SYNC_INTERVAL_MINUTES', 15)
    last_sync = getattr(settings, 'LAST_SYNC_AT', None)
    
    return {
        "is_running": is_running,
        "interval_minutes": interval_minutes,
        "last_sync_at": last_sync.isoformat() if last_sync else None
    }


async def trigger_sync() -> Dict[str, Any]:
    return await _sync_service.sync_ado_bugs()


async def update_sync_config(interval_minutes: int) -> Dict[str, Any]:
    settings.SYNC_INTERVAL_MINUTES = interval_minutes
    
    if not _sync_service.is_running() and interval_minutes > 0:
        await _sync_service.start_scheduler()
    elif _sync_service.is_running() and interval_minutes <= 0:
        await _sync_service.stop_scheduler()
    
    return {"interval_minutes": interval_minutes, "status": "updated"}