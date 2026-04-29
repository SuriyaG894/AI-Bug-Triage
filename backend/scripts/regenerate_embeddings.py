import asyncio
import asyncpg
import os
import sys

sys.path.insert(0, "/app")
os.chdir("/app")

from app.services.ai.embedding_service import generate_embedding


async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@postgres:5432/bug_triage")
    parsed = db_url.replace("+asyncpg", "")
    
    conn = await asyncpg.connect(parsed)
    
    try:
        await conn.execute("DROP TABLE IF EXISTS bug_embeddings")
    except:
        pass
    
    await conn.execute("""
        CREATE TABLE bug_embeddings (
            id SERIAL PRIMARY KEY,
            bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
            embedding vector(384),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(bug_id)
        )
    """)
    await conn.execute("CREATE INDEX ix_bug_embeddings_bug_id ON bug_embeddings(bug_id)")
    
    bugs = await conn.fetch("SELECT id, title, description FROM bugs")
    print(f"Found {len(bugs)} bugs to update")
    
    for bug in bugs:
        bug_id, title, description = bug
        text = f"{title or ''} {description or ''}".strip() or "unknown"
        
        embedding = generate_embedding(text)
        
        if embedding:
            emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
            await conn.execute(
                """
                INSERT INTO bug_embeddings (bug_id, embedding)
                VALUES ($1, $2::vector)
                ON CONFLICT (bug_id) DO UPDATE SET embedding = $2::vector
                """,
                bug_id,
                emb_str
            )
            print(f"Updated bug {bug_id}")
    
    await conn.close()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())