"""
CLI for Bug Triage Sync Commands
Usage: python -m app.cli sync --source ado
"""

import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, AsyncSessionLocal
from app.core.config import settings
from app.models import Bug, BugEmbedding
from app.services.integrations.azure_devops import create_azure_client
from app.services.ai.groq_service import generate_embedding


async def sync_from_ado(limit: int = 100):
    """Sync work items from Azure DevOps to local database"""
    print(f"Syncing up to {limit} work items from Azure DevOps...")
    
    from app.core.config import decrypt_api_key
    
    pat = settings.AZURE_DEVOPS_PAT
    if pat.startswith("ENC:"):
        pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)
    
    client = create_azure_client(pat)
    if not client:
        print("Failed to create ADO client")
        return 1
    
    work_items = await client.get_work_items()
    if not work_items:
        print("No work items found in ADO")
        return 1
    
    print(f"Found {len(work_items)} work items in ADO")
    
    synced = 0
    async with AsyncSessionLocal() as db:
        for item in work_items[:limit]:
            ext_id = str(item.get("id"))
            
            # Check if already exists
            from sqlalchemy import select
            result = await db.execute(
                select(Bug).where(Bug.external_id == ext_id)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"  Skipping {ext_id} - already exists")
                continue
            
            # Create new bug
            title = item.get("title", "Unknown")
            description = item.get("description", "") or "Synced from ADO"
            severity = item.get("severity", "3 - Medium") or "3 - Medium"
            
            new_bug = Bug(
                title=title,
                description=description,
                severity=severity,
                type="bug",
                status="open",
                source="azure_devops",
                external_id=ext_id,
                created_by="system"
            )
            
            db.add(new_bug)
            await db.flush()
            
            # Generate embedding
            embedding = await generate_embedding(f"{title} {description}")
            if embedding:
                bug_emb = BugEmbedding(
                    bug_id=new_bug.id,
                    embedding=embedding
                )
                db.add(bug_emb)
            
            synced += 1
            print(f"  Synced: {ext_id} - {title[:50]}")
        
        await db.commit()
    
    print(f"\nDone! Synced {synced} work items from ADO")
    return 0


async def sync_to_ado(bug_id: int):
    """Push a specific bug to Azure DevOps"""
    print(f"Pushing bug {bug_id} to Azure DevOps...")
    
    from app.core.config import decrypt_api_key
    from app.services.integrations.azure_devops import create_azure_client
    
    pat = settings.AZURE_DEVOPS_PAT
    if pat.startswith("ENC:"):
        pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)
    
    client = create_azure_client(pat)
    
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(Bug).where(Bug.id == bug_id))
        bug = result.scalar_one_or_none()
        
        if not bug:
            print(f"Bug {bug_id} not found")
            return 1
        
        result_data = await client.create_work_item(
            title=bug.title,
            description=bug.description,
            severity=bug.severity,
            bug_type=bug.type,
            repro_steps=bug.repro_steps,
            expected_result=bug.expected_result,
            actual_result=bug.actual_result,
            attachments=bug.attachments,
            assigned_to=bug.assigned_to
        )
        
        if result_data.get("success"):
            bug.external_id = result_data.get("external_id")
            await db.commit()
            print(f"Successfully pushed! ADO ID: {result_data.get('external_id')}")
            return 0
        else:
            print(f"Failed: {result_data.get('message')}")
            return 1


def main():
    parser = argparse.ArgumentParser(description="Bug Triage CLI")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Sync command
    sync_parser = subparsers.add_parser("sync", help="Sync bugs")
    sync_parser.add_argument("--source", choices=["ado", "local"], default="ado",
                           help="Sync source")
    sync_parser.add_argument("--limit", type=int, default=100,
                           help="Maximum items to sync")
    
    # Push command
    push_parser = subparsers.add_parser("push", help="Push bug to ADO")
    push_parser.add_argument("bug_id", type=int, help="Bug ID to push")
    
    args = parser.parse_args()
    
    if args.command == "sync":
        if args.source == "ado":
            return asyncio.run(sync_from_ado(args.limit))
        else:
            print("Local sync not implemented yet")
            return 1
    
    elif args.command == "push":
        return asyncio.run(sync_to_ado(args.bug_id))
    
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())