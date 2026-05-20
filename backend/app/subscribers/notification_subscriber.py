from sqlalchemy import select

from app.core.events import Event
from app.core.database import AsyncSessionLocal, User, Notification


async def on_bug_assigned(event: Event):
    bug_id = event.payload["bug_id"]
    title = event.payload["title"]
    assignee_email = event.payload["assignee_email"]
    changed_by = event.payload.get("changed_by", "system")

    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(select(User).where(User.email == assignee_email))
        ).scalar_one_or_none()
        if not user:
            return

        db.add(
            Notification(
                user_id=user.id,
                type="bug_assigned",
                title="Bug Assigned to You",
                message=f"Bug '{title}' has been assigned to you by {changed_by}",
                link=f"/bugs/{bug_id}",
                metadata_=dict(event.payload),
            )
        )
        await db.commit()


async def on_bug_status_changed(event: Event):
    bug_id = event.payload["bug_id"]
    title = event.payload["title"]
    old_status = event.payload["old_status"]
    new_status = event.payload["new_status"]
    changed_by = event.payload.get("changed_by", "system")
    reporter_id = event.payload.get("reporter_id")
    assigned_to = event.payload.get("assigned_to")

    async with AsyncSessionLocal() as db:
        notified = set()

        if reporter_id:
            notified.add(reporter_id)
            db.add(
                Notification(
                    user_id=reporter_id,
                    type="bug_status_changed",
                    title="Bug Status Changed",
                    message=f"Bug '{title}' changed from {old_status} to {new_status} by {changed_by}",
                    link=f"/bugs/{bug_id}",
                    metadata_=dict(event.payload),
                )
            )

        if assigned_to:
            user = (
                await db.execute(select(User).where(User.email == assigned_to))
            ).scalar_one_or_none()
            if user and user.id not in notified:
                db.add(
                    Notification(
                        user_id=user.id,
                        type="bug_status_changed",
                        title="Bug Status Changed",
                        message=f"Bug '{title}' changed from {old_status} to {new_status} by {changed_by}",
                        link=f"/bugs/{bug_id}",
                        metadata_=dict(event.payload),
                    )
                )

        await db.commit()


async def on_bug_deleted(event: Event):
    reporter_id = event.payload.get("reporter_id")
    if not reporter_id:
        return

    async with AsyncSessionLocal() as db:
        db.add(
            Notification(
                user_id=reporter_id,
                type="bug_deleted",
                title="Bug Deleted",
                message=f"Bug '{event.payload['title']}' was deleted by {event.payload.get('deleted_by', 'an admin')}",
                link="/bugs",
                metadata_=dict(event.payload),
            )
        )
        await db.commit()


async def on_sync_bug_updated(event: Event):
    reporter_id = event.payload.get("reporter_id")
    if not reporter_id:
        return

    async with AsyncSessionLocal() as db:
        db.add(
            Notification(
                user_id=reporter_id,
                type="bug_status_changed",
                title="Bug Status Changed (Synced from Azure DevOps)",
                message=(
                    f"Bug '{event.payload['title']}' changed from "
                    f"{event.payload['old_status']} to {event.payload['new_status']}"
                ),
                link=f"/bugs/{event.payload['bug_id']}",
                metadata_=dict(event.payload),
            )
        )
        await db.commit()
