import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.core.database import User
from app.api.routes.auth import create_access_token

async def test():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == 6))
        user = result.scalar_one_or_none()
        token = create_access_token({"sub": str(user.id), "email": user.email})
        print(token)

asyncio.run(test())
