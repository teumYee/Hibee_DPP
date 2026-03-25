"""add snapshot v3 columns and unique constraint

Revision ID: 20260324_snapshot_v3
Revises: down_revision
Create Date: 2026-03-24 15:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260324_snapshot_v3"
down_revision: Union[str, Sequence[str], None] = "down_revision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("daily_snap_shots", sa.Column("snapshot_date", sa.Date(), nullable=True))
    op.add_column("daily_snap_shots", sa.Column("timezone", sa.String(length=100), nullable=True))
    op.add_column(
        "daily_snap_shots",
        sa.Column("time_of_day_buckets_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("daily_snap_shots", sa.Column("schema_version", sa.String(length=20), nullable=True))
    op.add_column("daily_snap_shots", sa.Column("source_hash", sa.String(length=255), nullable=True))

    op.create_unique_constraint(
        "uq_daily_snapshots_user_date_package",
        "daily_snap_shots",
        ["user_id", "snapshot_date", "package_name"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_daily_snapshots_user_date_package", "daily_snap_shots", type_="unique")
    op.drop_column("daily_snap_shots", "source_hash")
    op.drop_column("daily_snap_shots", "schema_version")
    op.drop_column("daily_snap_shots", "time_of_day_buckets_json")
    op.drop_column("daily_snap_shots", "timezone")
    op.drop_column("daily_snap_shots", "snapshot_date")
