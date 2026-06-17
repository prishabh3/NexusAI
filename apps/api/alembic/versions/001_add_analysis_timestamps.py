"""add started_at and completed_at to analyses

Revision ID: 001
Revises:
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("analyses", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("analyses", "completed_at")
    op.drop_column("analyses", "started_at")
