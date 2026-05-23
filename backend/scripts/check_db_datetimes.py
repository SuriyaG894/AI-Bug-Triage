import asyncio
import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models import Bug
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        print("=== Checking Bug ID 64 ===")
        res = await db.execute(select(Bug).where(Bug.id == 64))
        bug = res.scalar_one_or_none()
        if bug:
            print(f"Bug ID: {bug.id}")
            print(f"title: {bug.title}")
            print(f"description: {repr(bug.description)}")
            print(f"repro_steps: {repr(bug.repro_steps)}")
            print(f"expected_result: {repr(bug.expected_result)}")
            print(f"actual_result: {repr(bug.actual_result)}")
        else:
            print("Bug ID 64 not found in database!")

if __name__ == "__main__":
    asyncio.run(check())
