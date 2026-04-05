"""add common checkin group tables

Revision ID: 20260405_common_checkin_groups
Revises: 20260405_sea_friend_gamification
Create Date: 2026-04-05 21:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260405_common_checkin_groups"
down_revision: Union[str, Sequence[str], None] = "20260405_sea_friend_gamification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("daily_checkins", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "stroll_groups",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=100), nullable=True),
        sa.Column("group_code", sa.String(length=12), nullable=False),
        sa.Column("join_mode", sa.String(length=20), nullable=False, server_default="CODE"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("week_start_date", sa.Date(), nullable=False),
        sa.Column("week_end_date", sa.Date(), nullable=False),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("target_checkin_count", sa.Integer(), nullable=False),
        sa.Column("current_checkin_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reward_coin", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("dolphin_name", sa.String(length=50), nullable=True),
        sa.Column("ending_snapshot", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("challenge_started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.UniqueConstraint("group_code", name="uq_stroll_groups_group_code"),
    )
    op.create_index(op.f("ix_stroll_groups_id"), "stroll_groups", ["id"], unique=False)
    op.create_index(op.f("ix_stroll_groups_group_code"), "stroll_groups", ["group_code"], unique=False)
    op.create_index(op.f("ix_stroll_groups_week_start_date"), "stroll_groups", ["week_start_date"], unique=False)
    op.create_index(op.f("ix_stroll_groups_week_end_date"), "stroll_groups", ["week_end_date"], unique=False)

    op.create_table(
        "stroll_group_members",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("member_status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("join_source", sa.String(length=20), nullable=False, server_default="CODE"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contribution_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reward_claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["stroll_groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("group_id", "user_id", name="uq_stroll_group_members_group_user"),
    )
    op.create_index(op.f("ix_stroll_group_members_id"), "stroll_group_members", ["id"], unique=False)
    op.create_index(op.f("ix_stroll_group_members_group_id"), "stroll_group_members", ["group_id"], unique=False)
    op.create_index(op.f("ix_stroll_group_members_user_id"), "stroll_group_members", ["user_id"], unique=False)

    op.create_table(
        "stroll_group_checkin_contributions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("group_member_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("checkin_id", sa.Integer(), nullable=True),
        sa.Column("checkin_date", sa.Date(), nullable=False),
        sa.Column("counted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["checkin_id"], ["daily_checkins.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["group_id"], ["stroll_groups.id"]),
        sa.ForeignKeyConstraint(["group_member_id"], ["stroll_group_members.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("group_id", "user_id", "checkin_date", name="uq_stroll_group_contribution_daily"),
    )
    op.create_index(
        op.f("ix_stroll_group_checkin_contributions_id"),
        "stroll_group_checkin_contributions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_stroll_group_checkin_contributions_group_id"),
        "stroll_group_checkin_contributions",
        ["group_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_stroll_group_checkin_contributions_group_member_id"),
        "stroll_group_checkin_contributions",
        ["group_member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_stroll_group_checkin_contributions_user_id"),
        "stroll_group_checkin_contributions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_stroll_group_checkin_contributions_checkin_date"),
        "stroll_group_checkin_contributions",
        ["checkin_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_stroll_group_checkin_contributions_checkin_date"), table_name="stroll_group_checkin_contributions")
    op.drop_index(op.f("ix_stroll_group_checkin_contributions_user_id"), table_name="stroll_group_checkin_contributions")
    op.drop_index(op.f("ix_stroll_group_checkin_contributions_group_member_id"), table_name="stroll_group_checkin_contributions")
    op.drop_index(op.f("ix_stroll_group_checkin_contributions_group_id"), table_name="stroll_group_checkin_contributions")
    op.drop_index(op.f("ix_stroll_group_checkin_contributions_id"), table_name="stroll_group_checkin_contributions")
    op.drop_table("stroll_group_checkin_contributions")

    op.drop_index(op.f("ix_stroll_group_members_user_id"), table_name="stroll_group_members")
    op.drop_index(op.f("ix_stroll_group_members_group_id"), table_name="stroll_group_members")
    op.drop_index(op.f("ix_stroll_group_members_id"), table_name="stroll_group_members")
    op.drop_table("stroll_group_members")

    op.drop_index(op.f("ix_stroll_groups_week_end_date"), table_name="stroll_groups")
    op.drop_index(op.f("ix_stroll_groups_week_start_date"), table_name="stroll_groups")
    op.drop_index(op.f("ix_stroll_groups_group_code"), table_name="stroll_groups")
    op.drop_index(op.f("ix_stroll_groups_id"), table_name="stroll_groups")
    op.drop_table("stroll_groups")

    op.drop_column("daily_checkins", "completed_at")
