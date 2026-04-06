"""fix pattern_candidates_daily candidates column

Revision ID: 20260406_fix_pattern_candidates
Revises: 20260405_common_checkin_groups
Create Date: 2026-04-06 22:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260406_fix_pattern_candidates"
down_revision: Union[str, Sequence[str], None] = "20260405_common_checkin_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(bind: sa.engine.Connection, table_name: str) -> bool:
    return sa.inspect(bind).has_table(table_name)


def _column_names(bind: sa.engine.Connection, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    table_name = "pattern_candidates_daily"

    if not _has_table(bind, table_name):
        return

    columns = _column_names(bind, table_name)

    if "selected_patterns" in columns and "candidates" not in columns:
        op.alter_column(
            table_name,
            "selected_patterns",
            new_column_name="candidates",
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=True,
        )
        return

    if "candidates" not in columns:
        op.add_column(
            table_name,
            sa.Column("candidates", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    columns = _column_names(bind, table_name)
    if "selected_patterns" in columns and "candidates" in columns:
        op.execute(
            """
            UPDATE pattern_candidates_daily
            SET candidates = selected_patterns
            WHERE candidates IS NULL
              AND selected_patterns IS NOT NULL
            """
        )
        op.drop_column(table_name, "selected_patterns")


def downgrade() -> None:
    bind = op.get_bind()
    table_name = "pattern_candidates_daily"

    if not _has_table(bind, table_name):
        return

    columns = _column_names(bind, table_name)

    if "candidates" in columns and "selected_patterns" not in columns:
        op.alter_column(
            table_name,
            "candidates",
            new_column_name="selected_patterns",
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=True,
        )
        return

    if "selected_patterns" not in columns:
        op.add_column(
            table_name,
            sa.Column("selected_patterns", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    columns = _column_names(bind, table_name)
    if "candidates" in columns and "selected_patterns" in columns:
        op.execute(
            """
            UPDATE pattern_candidates_daily
            SET selected_patterns = candidates
            WHERE selected_patterns IS NULL
              AND candidates IS NOT NULL
            """
        )
        op.drop_column(table_name, "candidates")
