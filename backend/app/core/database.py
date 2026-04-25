from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    JSON,
    Float,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from datetime import datetime

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


class Bug(Base):
    __tablename__ = "bugs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="medium")
    severity = Column(String(20), nullable=False)
    type = Column(String(50), nullable=False)
    status = Column(String(20), default="open")
    source = Column(String(20), default="internal")
    external_id = Column(String(100), nullable=True)
    push_to_external = Column(Boolean, default=False)
    created_by = Column(String(100), nullable=True)
    repro_steps = Column(Text, nullable=True)
    expected_result = Column(Text, nullable=True)
    actual_result = Column(Text, nullable=True)
    attachments = Column(JSON, nullable=True)
    assigned_to = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BugEmbedding(Base):
    __tablename__ = "bug_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, index=True, nullable=False)
    embedding = Column(Vector(1536))
    created_at = Column(DateTime, default=datetime.utcnow)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, index=True, nullable=False)
    root_causes = Column(JSONB, nullable=True)
    confidence_scores = Column(JSONB, nullable=True)
    analyzed_at = Column(DateTime, default=datetime.utcnow)


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    tool_type = Column(String(20), nullable=False)
    name = Column(String(100), nullable=True)
    auth_type = Column(String(20), nullable=False)
    credentials = Column(Text, nullable=True)
    config = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExternalIssueCache(Base):
    __tablename__ = "external_issue_cache"

    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(Integer, index=True, nullable=False)
    external_id = Column(String(100), nullable=False)
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    embedding = Column(Vector(1536))
    extra_data = Column(JSONB, nullable=True)
    cached_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
