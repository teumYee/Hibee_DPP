"""add snapshot breakdown and checkin policy columns

Revision ID: 20260406_snapshot_policy
Revises: 20260406_fix_pattern_candidates
Create Date: 2026-04-06 23:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260406_snapshot_policy"
down_revision: Union[str, Sequence[str], None] = "20260406_fix_pattern_candidates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(bind: sa.engine.Connection, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()

    snapshot_columns = _column_names(bind, "daily_snap_shots")
    if "per_app_usage_json" not in snapshot_columns:
        op.add_column(
            "daily_snap_shots",
            sa.Column("per_app_usage_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    if "per_category_usage_json" not in snapshot_columns:
        op.add_column(
            "daily_snap_shots",
            sa.Column("per_category_usage_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    if "timeline_buckets_json" not in snapshot_columns:
        op.add_column(
            "daily_snap_shots",
            sa.Column("timeline_buckets_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    if "top_apps_json" not in snapshot_columns:
        op.add_column(
            "daily_snap_shots",
            sa.Column("top_apps_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    user_config_columns = _column_names(bind, "user_configs")
    if "checkin_window_minutes" not in user_config_columns:
        op.add_column(
            "user_configs",
            sa.Column(
                "checkin_window_minutes",
                sa.Integer(),
                nullable=False,
                server_default="120",
            ),
        )
    if "day_rollover_time" not in user_config_columns:
        op.add_column(
            "user_configs",
            sa.Column(
                "day_rollover_time",
                sa.String(length=5),
                nullable=False,
                server_default="04:00",
            ),
        )

    op.alter_column("user_configs", "checkin_window_minutes", server_default=None)
    op.alter_column("user_configs", "day_rollover_time", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    user_config_columns = _column_names(bind, "user_configs")
    if "day_rollover_time" in user_config_columns:
        op.drop_column("user_configs", "day_rollover_time")
    if "checkin_window_minutes" in user_config_columns:
        op.drop_column("user_configs", "checkin_window_minutes")

    snapshot_columns = _column_names(bind, "daily_snap_shots")
    if "top_apps_json" in snapshot_columns:
        op.drop_column("daily_snap_shots", "top_apps_json")
    if "timeline_buckets_json" in snapshot_columns:
        op.drop_column("daily_snap_shots", "timeline_buckets_json")
    if "per_category_usage_json" in snapshot_columns:
        op.drop_column("daily_snap_shots", "per_category_usage_json")
    if "per_app_usage_json" in snapshot_columns:
        op.drop_column("daily_snap_shots", "per_app_usage_json")
