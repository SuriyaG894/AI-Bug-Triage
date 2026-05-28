import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as session:
        # Clear tables
        await session.execute(text("TRUNCATE TABLE bug_comments CASCADE;"))
        await session.execute(text("TRUNCATE TABLE bug_embeddings CASCADE;"))
        await session.execute(text("TRUNCATE TABLE analysis_results CASCADE;"))
        await session.execute(text("TRUNCATE TABLE sync_state CASCADE;"))
        await session.execute(text("TRUNCATE TABLE bugs CASCADE;"))
        await session.commit()
        print("Database cleared successfully!")

if __name__ == '__main__':
    asyncio.run(main())
