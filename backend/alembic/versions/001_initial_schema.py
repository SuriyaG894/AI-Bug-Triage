"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "bugs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="open"),
        sa.Column("source", sa.String(length=20), server_default="internal"),
        sa.Column("external_id", sa.String(length=100), nullable=True),
        sa.Column("push_to_external", sa.Boolean(), server_default="false"),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bugs_id", "bugs", ["id"])

    op.create_table(
        "bug_embeddings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bug_id", sa.Integer(), nullable=False),
        sa.Column(
            "embedding", postgresql.ARRAY(sa.Float(), dimensions=1), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bug_id"], ["bugs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_bug_embeddings_id", "bug_embeddings", ["id"])
    op.create_index("ix_bug_embeddings_bug_id", "bug_embeddings", ["bug_id"])

    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bug_id", sa.Integer(), nullable=False),
        sa.Column("root_causes", postgresql.JSONB(), nullable=True),
        sa.Column("confidence_scores", postgresql.JSONB(), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bug_id"], ["bugs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_analysis_results_id", "analysis_results", ["id"])
    op.create_index("ix_analysis_results_bug_id", "analysis_results", ["bug_id"])

    op.create_table(
        "integrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tool_type", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("auth_type", sa.String(length=20), nullable=False),
        sa.Column("credentials", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_integrations_id", "integrations", ["id"])

    op.create_table(
        "external_issue_cache",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("integration_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "embedding", postgresql.ARRAY(sa.Float(), dimensions=1), nullable=True
        ),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("cached_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["integrations.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_external_issue_cache_id", "external_issue_cache", ["id"])
    op.create_index(
        "ix_external_issue_cache_integration_id",
        "external_issue_cache",
        ["integration_id"],
    )


def downgrade() -> None:
    op.drop_table("external_issue_cache")
    op.drop_table("integrations")
    op.drop_table("analysis_results")
    op.drop_table("bug_embeddings")
    op.drop_table("bugs")
    op.execute("DROP EXTENSION IF EXISTS vector")
