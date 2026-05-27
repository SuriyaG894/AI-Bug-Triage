import asyncio
import os
import sys
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List


from sqlalchemy import select, and_, text

from app.services.ai.embedding_service import generate_embedding
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models import Bug, BugEmbedding, BugComment, SyncState, Integration
from app.services.integrations.azure_devops import AzureDevOpsClient, get_active_ado_config
from app.services.integrations.field_mapping import (
    ado_to_local,
    extract_ado_timestamp,
    strip_html,
)
from app.core.events import event_bus, Event
from app.core import event_names


class SyncService:
    def __init__(self):
        self._sync_task: Optional[asyncio.Task] = None
        self._running = False
        self._last_sync_at: Optional[datetime] = None
        self._last_sync_result: Optional[Dict[str, Any]] = None
        self._total_synced: int = 0

    async def sync_ado_bugs(self) -> Dict[str, Any]:
        result = {
            "synced": 0,
            "updated": 0,
            "errors": 0,
            "conflicts": 0,
            "comments_synced": 0,
            "skipped": 0,
            "started_at": datetime.utcnow().isoformat(),
        }

        try:
            async with AsyncSessionLocal() as db:
                ado_config = await get_active_ado_config(db)
                if not ado_config or not ado_config.get("org"):
                    result["completed_at"] = datetime.now(timezone.utc).isoformat()
                    return self._record_sync_result(result)

                client = AzureDevOpsClient(
                    org=ado_config["org"],
                    pat=ado_config["pat"],
                    project=ado_config.get("project"),
                )

                work_items = await client.get_work_items()

                # Check for deleted work items in ADO and clean up locally
                ado_ids = {str(item.get("id")) for item in work_items if item.get("id")}
                local_bugs_result = await db.execute(
                    select(Bug).where(Bug.external_id.isnot(None))
                )
                local_bugs = local_bugs_result.scalars().all()
                for local_bug in local_bugs:
                    if local_bug.external_id not in ado_ids:
                        if local_bug.source == "azure_devops":
                            await db.execute(
                                text("DELETE FROM bug_embeddings WHERE bug_id = :bid"),
                                {"bid": local_bug.id}
                            )
                            await db.execute(
                                text("DELETE FROM analysis_results WHERE bug_id = :bid"),
                                {"bid": local_bug.id}
                            )
                            await db.delete(local_bug)
                        else:
                            local_bug.external_id = None
                            local_bug.push_to_external = False
                            await db.execute(
                                text("DELETE FROM sync_state WHERE bug_id = :bid"),
                                {"bid": local_bug.id}
                            )
                await db.commit()

                if not work_items:
                    result["completed_at"] = datetime.now(timezone.utc).isoformat()
                    await self._persist_integration_sync_time(db)
                    return self._record_sync_result(result)

                all_events: List[Event] = []
                for item in work_items[:50]:
                    try:
                        ext_id = str(item.get("id"))
                        events = await self._sync_single_bug(db, client, ext_id, result)
                        all_events.extend(events)
                    except Exception as e:
                        print(f"Error syncing bug {item.get('id')}: {e}")
                        result["errors"] += 1

                if result["synced"] > 0 or result["updated"] > 0 or result["comments_synced"] > 0:
                    await db.commit()
                    for event in all_events:
                        await event_bus.publish(event)

                await self._persist_integration_sync_time(db)

        except Exception as e:
            result["completed_at"] = datetime.now(timezone.utc).isoformat()
            return self._record_sync_result(result, error=str(e))

        result["completed_at"] = datetime.now(timezone.utc).isoformat()
        result["fetched"] = result["synced"] + result["updated"]
        return self._record_sync_result(result)

    async def _persist_integration_sync_time(self, db):
        integration_result = await db.execute(
            select(Integration).where(
                Integration.tool_type == "azure_devops",
                Integration.is_active == True,
            )
        )
        integration = integration_result.scalar_one_or_none()
        if integration:
            integration.last_sync_at = datetime.utcnow()
            await db.commit()

    def _record_sync_result(self, result: Dict[str, Any], error: Optional[str] = None) -> Dict[str, Any]:
        self._last_sync_at = datetime.now(timezone.utc)
        self._last_sync_result = {
            "synced": result.get("synced", 0),
            "updated": result.get("updated", 0),
            "errors": result.get("errors", 0),
            "conflicts": result.get("conflicts", 0),
            "comments_synced": result.get("comments_synced", 0),
            "fetched": result.get("synced", 0) + result.get("updated", 0),
        }
        if error:
            self._last_sync_result["error"] = error
        self._total_synced += result.get("synced", 0) + result.get("updated", 0)
        return result

    async def _sync_single_bug(
        self,
        db,
        client: AzureDevOpsClient,
        ext_id: str,
        result: Dict[str, Any],
    ) -> List[Event]:
        details = await client.get_work_item_details(ext_id)
        if not details:
            result["errors"] += 1
            return []

        fields = details.get("fields", {})
        ado_changed_date = extract_ado_timestamp(fields.get("System.ChangedDate"))

        existing_bug_result = await db.execute(
            select(Bug).where(Bug.external_id == ext_id)
        )
        existing_bug = existing_bug_result.scalar_one_or_none()

        if existing_bug:
            return await self._update_existing_bug(
                db, client, existing_bug, fields, ado_changed_date, result
            )
        else:
            await self._create_bug_from_ado(
                db, client, details, fields, ext_id, ado_changed_date, result
            )
            return []

    async def _create_bug_from_ado(
        self,
        db,
        client: AzureDevOpsClient,
        details: Dict[str, Any],
        fields: Dict[str, Any],
        ext_id: str,
        ado_changed_date: Optional[datetime],
        result: Dict[str, Any],
    ):
        mapped = ado_to_local(fields)
        title = mapped.get("title") or fields.get("System.Title", "Unknown")
        description = mapped.get("description") or strip_html(
            fields.get("System.Description", "")
        ) or "Synced from ADO"

        created_by_val = fields.get("System.CreatedBy")
        creator_email = "system"
        if isinstance(created_by_val, dict):
            creator_email = created_by_val.get("uniqueName") or created_by_val.get("displayName") or "system"
        elif created_by_val:
            creator_email = str(created_by_val)

        ado_changed_naive = ado_changed_date.replace(tzinfo=None) if ado_changed_date else None

        bug = Bug(
            title=title,
            description=description,
            repro_steps=mapped.get("repro_steps"),
            expected_result=mapped.get("expected_result"),
            actual_result=mapped.get("actual_result"),
            severity=mapped.get("severity", "medium"),
            priority=mapped.get("priority", "medium"),
            type="bug",
            status=mapped.get("status", "open"),
            source="azure_devops",
            external_id=ext_id,
            assigned_to=mapped.get("assigned_to"),
            last_external_updated_at=ado_changed_naive,
            created_by=creator_email,
        )
        db.add(bug)
        await db.flush()

        embedding = generate_embedding(f"{title} {description} {bug.repro_steps or ''}".strip())
        if embedding and len(embedding) >= 384:
            db.add(BugEmbedding(bug_id=bug.id, embedding=embedding))

        sync_state = SyncState(
            bug_id=bug.id,
            external_id=ext_id,
            last_synced_at=datetime.utcnow(),
            external_updated_at=ado_changed_naive,
            status="in_sync",
        )
        db.add(sync_state)

        await self._sync_comments_for_bug(db, client, ext_id, bug.id, result)

        result["synced"] += 1

    async def _update_existing_bug(
        self,
        db,
        client: AzureDevOpsClient,
        bug: Bug,
        fields: Dict[str, Any],
        ado_changed_date: Optional[datetime],
        result: Dict[str, Any],
    ) -> List[Event]:
        events: List[Event] = []

        sync_state_result = await db.execute(
            select(SyncState).where(SyncState.bug_id == bug.id)
        )
        sync_state = sync_state_result.scalar_one_or_none()

        if not ado_changed_date:
            result["skipped"] += 1
            return events

        # Force naive datetimes for comparison and database fields to prevent timezone mismatch errors
        ado_changed_naive = ado_changed_date.replace(tzinfo=None)
        last_ext_naive = bug.last_external_updated_at.replace(tzinfo=None) if bug.last_external_updated_at else None

        if (
            last_ext_naive
            and ado_changed_naive <= last_ext_naive
        ):
            result["skipped"] += 1
            return events

        mapped = ado_to_local(fields)
        changed = False
        old_status = bug.status
        old_assigned_to = bug.assigned_to

        if mapped.get("title") and mapped["title"] != bug.title:
            bug.title = mapped["title"]
            changed = True

        if mapped.get("description") and mapped["description"] != bug.description:
            bug.description = mapped["description"]
            changed = True

        if mapped.get("repro_steps") and mapped["repro_steps"] != bug.repro_steps:
            bug.repro_steps = mapped["repro_steps"]
            changed = True

        if mapped.get("expected_result") and mapped["expected_result"] != bug.expected_result:
            bug.expected_result = mapped["expected_result"]
            changed = True

        if mapped.get("actual_result") and mapped["actual_result"] != bug.actual_result:
            bug.actual_result = mapped["actual_result"]
            changed = True

        if mapped.get("status") and mapped["status"] != bug.status:
            bug.status = mapped["status"]
            changed = True

        if mapped.get("severity") and mapped["severity"] != bug.severity:
            bug.severity = mapped["severity"]
            changed = True

        if mapped.get("priority") and mapped["priority"] != bug.priority:
            bug.priority = mapped["priority"]
            changed = True

        if mapped.get("assigned_to") and mapped["assigned_to"] != bug.assigned_to:
            bug.assigned_to = mapped["assigned_to"]
            changed = True

        if changed:
            bug.last_external_updated_at = ado_changed_naive
            bug.updated_at = datetime.utcnow()
            result["updated"] += 1

            if mapped.get("status") and mapped["status"] != old_status:
                events.append(Event(event_names.SYNC_BUG_UPDATED, {
                    "bug_id": bug.id,
                    "title": bug.title,
                    "old_status": old_status,
                    "new_status": bug.status,
                    "reporter_id": bug.reporter_id,
                    "assigned_to": bug.assigned_to,
                }))

            embedding = generate_embedding(f"{bug.title} {bug.description} {bug.repro_steps or ''}".strip())
            if embedding and len(embedding) >= 384:
                await db.execute(
                    text("DELETE FROM bug_embeddings WHERE bug_id = :bid"),
                    {"bid": bug.id},
                )
                db.add(BugEmbedding(bug_id=bug.id, embedding=embedding))
        else:
            bug.last_external_updated_at = ado_changed_naive
            result["skipped"] += 1

        if sync_state:
            sync_state.last_synced_at = datetime.utcnow()
            sync_state.external_updated_at = ado_changed_naive
            sync_state.status = "in_sync"
        else:
            db.add(
                SyncState(
                    bug_id=bug.id,
                    external_id=bug.external_id,
                    last_synced_at=datetime.utcnow(),
                    external_updated_at=ado_changed_naive,
                    status="in_sync",
                )
            )

        await self._sync_comments_for_bug(db, client, bug.external_id, bug.id, result)

        return events

    async def _sync_comments_for_bug(
        self,
        db,
        client: AzureDevOpsClient,
        ext_id: str,
        bug_id: int,
        result: Dict[str, Any],
    ):
        try:
            ado_comments = await client.get_work_item_comments(ext_id)
            for ado_comment in ado_comments:
                comment_id = str(ado_comment.get("id", ""))
                if not comment_id:
                    continue

                existing = await db.execute(
                    select(BugComment).where(
                        and_(
                            BugComment.bug_id == bug_id,
                            BugComment.external_comment_id == comment_id,
                        )
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                author = ""
                created_by = ado_comment.get("createdBy", {})
                if isinstance(created_by, dict):
                    author = created_by.get("displayName", "")
                else:
                    author = str(created_by)

                body = ado_comment.get("text", "")
                db.add(
                    BugComment(
                        bug_id=bug_id,
                        external_comment_id=comment_id,
                        author=author,
                        body=body,
                    )
                )
                result["comments_synced"] += 1
        except Exception as e:
            print(f"Error syncing comments for bug {bug_id}: {e}")

    async def sync_single_bug(self, bug_id: int) -> Dict[str, Any]:
        result = {"synced": False, "updated": False, "error": None}

        try:
            async with AsyncSessionLocal() as db:
                bug_result = await db.execute(select(Bug).where(Bug.id == bug_id))
                bug = bug_result.scalar_one_or_none()

                if not bug:
                    return {**result, "error": "Bug not found"}

                ado_config = await get_active_ado_config(db)
                if not ado_config or not ado_config.get("org"):
                    return {**result, "error": "Azure DevOps not configured"}

                client = AzureDevOpsClient(
                    org=ado_config["org"],
                    pat=ado_config["pat"],
                    project=ado_config.get("project"),
                )

                ext_id = bug.external_id
                if not ext_id:
                    return {**result, "error": "Bug has no external_id"}

                try:
                    details = await client.get_work_item_details(ext_id)
                    if not details:
                        return {**result, "error": "Failed to fetch from ADO"}
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 404:
                        if bug.source == "azure_devops":
                            await db.execute(
                                text("DELETE FROM bug_embeddings WHERE bug_id = :bid"),
                                {"bid": bug.id}
                            )
                            await db.execute(
                                text("DELETE FROM analysis_results WHERE bug_id = :bid"),
                                {"bid": bug.id}
                            )
                            await db.delete(bug)
                            await db.commit()
                            return {**result, "synced": True, "updated": True, "message": "Bug deleted locally because it was deleted in ADO"}
                        else:
                            bug.external_id = None
                            bug.push_to_external = False
                            await db.execute(
                                text("DELETE FROM sync_state WHERE bug_id = :bid"),
                                {"bid": bug.id}
                            )
                            await db.commit()
                            return {**result, "synced": True, "updated": True, "message": "Bug unlinked from ADO because ADO work item was deleted"}
                    return {**result, "error": f"HTTP error fetching from ADO: {e.response.status_code}"}

                fields = details.get("fields", {})
                ado_changed_date = extract_ado_timestamp(
                    fields.get("System.ChangedDate")
                )

                sync_result = {"updated": 0, "skipped": 0, "comments_synced": 0}
                events = await self._update_existing_bug(
                    db, client, bug, fields, ado_changed_date, sync_result
                )

                await db.commit()
                for event in events:
                    await event_bus.publish(event)

                result["updated"] = bool(sync_result.get("updated", 0) > 0)
                result["synced"] = True
                return result

        except Exception as e:
            return {**result, "error": str(e)}

    async def _sync_loop(self):
        while self._running:
            try:
                await self.sync_ado_bugs()
            except Exception as e:
                print(f"Sync error: {e}")

            interval_minutes = getattr(settings, "SYNC_INTERVAL_MINUTES", 15)

            if interval_minutes <= 0:
                self._running = False
                break

            await asyncio.sleep(interval_minutes * 60)

    async def start_scheduler(self):
        if self._running:
            return {"status": "already running"}

        self._running = True
        self._sync_task = asyncio.create_task(self._sync_loop())

        interval_minutes = getattr(settings, "SYNC_INTERVAL_MINUTES", 15)
        return {
            "status": "started",
            "interval_minutes": interval_minutes,
            "next_sync_in_seconds": interval_minutes * 60,
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

    def get_status(self) -> Dict[str, Any]:
        return {
            "last_sync_at": self._last_sync_at.isoformat()
            if self._last_sync_at
            else None,
            "last_sync_result": self._last_sync_result,
            "total_synced": self._total_synced,
        }

    def clear_status(self):
        self._last_sync_at = None
        self._last_sync_result = None
        self._total_synced = 0


_sync_service = SyncService()


async def get_sync_status() -> Dict[str, Any]:
    is_running = _sync_service.is_running()
    interval_minutes = getattr(settings, "SYNC_INTERVAL_MINUTES", 15)

    status = _sync_service.get_status()

    conflict_count = 0
    try:
        async with AsyncSessionLocal() as db:
            conflict_result = await db.execute(
                select(SyncState).where(SyncState.status == "conflict")
            )
            conflicts = conflict_result.scalars().all()
            conflict_count = len(conflicts)
    except Exception:
        pass

    return {
        "is_running": is_running,
        "interval_minutes": interval_minutes,
        "last_sync_at": status.get("last_sync_at"),
        "last_sync_result": status.get("last_sync_result"),
        "total_synced": status.get("total_synced", 0),
        "conflicts": conflict_count,
    }


async def trigger_sync() -> Dict[str, Any]:
    return await _sync_service.sync_ado_bugs()


async def trigger_single_bug_sync(bug_id: int) -> Dict[str, Any]:
    return await _sync_service.sync_single_bug(bug_id)


async def update_sync_config(interval_minutes: int) -> Dict[str, Any]:
    old_interval = getattr(settings, "SYNC_INTERVAL_MINUTES", 15)
    settings.SYNC_INTERVAL_MINUTES = interval_minutes

    if _sync_service.is_running():
        if interval_minutes <= 0:
            await _sync_service.stop_scheduler()
        elif interval_minutes != old_interval:
            await _sync_service.stop_scheduler()
            await _sync_service.start_scheduler()
    else:
        if interval_minutes > 0:
            await _sync_service.start_scheduler()

    return {"interval_minutes": interval_minutes, "status": "updated"}
