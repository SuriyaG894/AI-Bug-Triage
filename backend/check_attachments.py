import asyncio
import json
from app.core.database import get_db, Bug
from sqlalchemy import select

async def check():
    async for db in get_db():
        result = await db.execute(select(Bug).order_by(Bug.id.desc()).limit(5))
        bugs = result.scalars().all()
        for b in bugs:
            att = b.attachments
            print(f"--- Bug #{b.id} ---")
            print(f"  title: {b.title}")
            print(f"  attachments count: {len(att) if att else 0}")
            if att:
                for i, a in enumerate(att):
                    keys = list(a.keys()) if isinstance(a, dict) else type(a).__name__
                    has_base64 = bool(a.get("content_base64")) if isinstance(a, dict) else False
                    print(f"  [{i}] keys={keys}, has_base64={has_base64}")
            print(f"  external_id: {b.external_id}")
            print(f"  push_to_external: {b.push_to_external}")

asyncio.run(check())
