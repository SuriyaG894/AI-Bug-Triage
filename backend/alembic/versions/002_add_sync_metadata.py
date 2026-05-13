"""Add sync metadata (bug_comments, sync_state, last_external_updated_at)

Revision ID: 002
Revises: 001
Create Date: 2025-01-01

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bugs",
        sa.Column("last_external_updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "bug_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bug_id", sa.Integer(), nullable=False),
        sa.Column("external_comment_id", sa.String(length=100), nullable=True),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bug_id"], ["bugs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_bug_comments_id", "bug_comments", ["id"])
    op.create_index("ix_bug_comments_bug_id", "bug_comments", ["bug_id"])

    op.create_table(
        "sync_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bug_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("external_updated_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bug_id"], ["bugs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sync_state_id", "sync_state", ["id"])
    op.create_index("ix_sync_state_bug_id", "sync_state", ["bug_id"])


def downgrade() -> None:
    op.drop_table("sync_state")
    op.drop_table("bug_comments")
    op.drop_column("bugs", "last_external_updated_at")
