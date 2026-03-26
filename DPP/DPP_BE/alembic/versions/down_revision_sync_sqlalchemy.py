"""루트 리비전 — revision id: "down_revision" (부모 없음: down_revision 변수 = None)

Revision ID: down_revision
Revises:
Create Date: 2026-03-22 12:00:13.549084

- 신규 테이블·KPT/리포트/RAG 관련 스키마 반영
- users 레거시 컬럼(current_xp, coin 등)은 DB에 유지 (데이터 보존, ORM 미사용 컬럼)
- daily_checkins: 기존 컬럼 제거 전 신규 컬럼·기본값 추가
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "down_revision"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category_master",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("option_text", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_category_master_id"), "category_master", ["id"], unique=False)

    op.create_table(
        "expert_knowledge",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_expert_knowledge_id"), "expert_knowledge", ["id"], unique=False)

    op.create_table(
        "onboarding_options_master",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("option_text", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_onboarding_options_master_id"),
        "onboarding_options_master",
        ["id"],
        unique=False,
    )

    op.create_table(
        "titles_master",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("requirement_count", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_titles_master_id"), "titles_master", ["id"], unique=False)

    op.create_table(
        "daily_snap_shots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("package_name", sa.String(), nullable=True),
        sa.Column("total_usage_check", sa.Integer(), nullable=True),
        sa.Column("unlock_count", sa.Integer(), nullable=True),
        sa.Column("time_of_day_buckets_sec", sa.Integer(), nullable=True),
        sa.Column("max_continuous_sec", sa.Integer(), nullable=True),
        sa.Column("app_launch_count", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_daily_snap_shots_id"), "daily_snap_shots", ["id"], unique=False)

    op.create_table(
        "pattern_candidates_daily",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("selected_patterns", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_pattern_candidates_daily_user_date"),
    )
    op.create_index(
        op.f("ix_pattern_candidates_daily_id"), "pattern_candidates_daily", ["id"], unique=False
    )

    op.create_table(
        "report_drafts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("total_time", sa.Integer(), nullable=True),
        sa.Column("late_night_usage", sa.Integer(), nullable=True),
        sa.Column("category_usage", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_report_drafts_id"), "report_drafts", ["id"], unique=False)

    op.create_table(
        "user_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("goals", sa.JSON(), nullable=True),
        sa.Column("active_times", sa.JSON(), nullable=True),
        sa.Column("struggles", sa.JSON(), nullable=True),
        sa.Column("night_mode_start", sa.String(), nullable=True),
        sa.Column("night_mode_end", sa.String(), nullable=True),
        sa.Column("checkin_time", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_configs_id"), "user_configs", ["id"], unique=False)

    op.create_table(
        "user_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("current_title_id", sa.Integer(), nullable=True),
        sa.Column("equipped_character", sa.Integer(), nullable=True),
        sa.Column("total_checkin_count", sa.Integer(), nullable=True),
        sa.Column("last_chekin_date", sa.DateTime(), nullable=True),
        sa.Column("last_login_date", sa.DateTime(), nullable=True),
        sa.Column("coin", sa.Integer(), nullable=True),
        sa.Column("continuous_days", sa.Integer(), nullable=True),
        sa.Column("friend_count", sa.Integer(), nullable=True),
        sa.Column("cheer_count", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["current_title_id"], ["titles_master.id"]),
        sa.ForeignKeyConstraint(["equipped_character"], ["characters.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_stats_id"), "user_stats", ["id"], unique=False)

    op.create_table(
        "pattern_candidates_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pattern_candidate_daily_id", sa.Integer(), nullable=True),
        sa.Column("verdict", sa.String(length=100), nullable=True),
        sa.Column("violations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["pattern_candidate_daily_id"], ["pattern_candidates_daily.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pattern_candidates_logs_id"), "pattern_candidates_logs", ["id"], unique=False
    )

    op.create_table(
        "report_evidence_trace",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_draft_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("search_queries", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("search_filters", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("must_include_concepts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("retrieved_evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["report_draft_id"], ["report_drafts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_report_evidence_trace_id"), "report_evidence_trace", ["id"], unique=False
    )

    op.create_table(
        "report_review_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("report_draft_id", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.Boolean(), nullable=False),
        sa.Column("issues", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("rewrite_brief", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("iteration_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["report_draft_id"], ["report_drafts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_report_review_logs_id"), "report_review_logs", ["id"], unique=False)

    op.alter_column(
        "calendar_events",
        "title",
        existing_type=sa.VARCHAR(length=100),
        nullable=False,
    )

    op.add_column(
        "daily_checkins",
        sa.Column("selected_patterns", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("daily_checkins", sa.Column("kpt_keep", sa.Text(), nullable=True))
    op.add_column("daily_checkins", sa.Column("kpt_problem", sa.Text(), nullable=True))
    op.add_column("daily_checkins", sa.Column("kpt_try", sa.Text(), nullable=True))
    op.add_column(
        "daily_checkins",
        sa.Column(
            "is_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_unique_constraint("uq_daily_checkins_user_date", "daily_checkins", ["user_id", "date"])
    op.drop_column("daily_checkins", "generated_question")
    op.drop_column("daily_checkins", "is_answered")
    op.drop_column("daily_checkins", "user_answer")
    op.drop_column("daily_checkins", "is_text_generated")
    op.drop_column("daily_checkins", "user_answer_text")

    op.alter_column(
        "daily_reports",
        "date",
        existing_type=sa.DATE(),
        type_=sa.DateTime(),
        existing_nullable=False,
    )
    op.alter_column(
        "daily_reports",
        "category_usage",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
    )

    op.drop_index(op.f("idx_usage_logs_user_package"), table_name="usage_logs", if_exists=True)
    op.create_index(op.f("ix_usage_logs_id"), "usage_logs", ["id"], unique=False)

    op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.add_column("weekly_reports", sa.Column("ai_score", sa.Float(), nullable=True))
    op.add_column("weekly_reports", sa.Column("checkin_count", sa.Integer(), nullable=True))
    op.add_column("weekly_reports", sa.Column("analysis", sa.Text(), nullable=True))
    op.add_column("weekly_reports", sa.Column("main_activity_time", sa.Text(), nullable=True))
    op.add_column("weekly_reports", sa.Column("better_day", sa.String(length=100), nullable=True))
    op.add_column("weekly_reports", sa.Column("try_area", sa.Text(), nullable=True))
    op.add_column("weekly_reports", sa.Column("ai_comment", sa.Text(), nullable=True))
    op.drop_column("weekly_reports", "category_usage_avg")
    op.drop_column("weekly_reports", "total_time_avg")
    op.drop_column("weekly_reports", "content_week")
    op.drop_column("weekly_reports", "late_night_usage_avg")


def downgrade() -> None:
    op.add_column(
        "weekly_reports",
        sa.Column(
            "late_night_usage_avg",
            sa.DOUBLE_PRECISION(precision=53),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "weekly_reports",
        sa.Column("content_week", sa.TEXT(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "weekly_reports",
        sa.Column(
            "total_time_avg",
            sa.DOUBLE_PRECISION(precision=53),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "weekly_reports",
        sa.Column(
            "category_usage_avg",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("weekly_reports", "ai_comment")
    op.drop_column("weekly_reports", "try_area")
    op.drop_column("weekly_reports", "better_day")
    op.drop_column("weekly_reports", "main_activity_time")
    op.drop_column("weekly_reports", "analysis")
    op.drop_column("weekly_reports", "checkin_count")
    op.drop_column("weekly_reports", "ai_score")

    op.drop_column("users", "updated_at")

    op.drop_index(op.f("ix_usage_logs_id"), table_name="usage_logs")
    op.create_index(
        op.f("idx_usage_logs_user_package"),
        "usage_logs",
        ["user_id", "package_name", "first_time_stamp"],
        unique=False,
    )

    op.alter_column(
        "daily_reports",
        "category_usage",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=postgresql.JSON(astext_type=sa.Text()),
        existing_nullable=True,
    )
    op.alter_column(
        "daily_reports",
        "date",
        existing_type=sa.DateTime(),
        type_=sa.DATE(),
        existing_nullable=False,
    )

    op.add_column(
        "daily_checkins",
        sa.Column("user_answer_text", sa.TEXT(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "daily_checkins",
        sa.Column("is_text_generated", sa.BOOLEAN(), autoincrement=False, nullable=False),
    )
    op.add_column(
        "daily_checkins",
        sa.Column("user_answer", sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    )
    op.add_column(
        "daily_checkins",
        sa.Column("is_answered", sa.BOOLEAN(), autoincrement=False, nullable=False),
    )
    op.add_column(
        "daily_checkins",
        sa.Column("generated_question", sa.TEXT(), autoincrement=False, nullable=True),
    )
    op.drop_constraint("uq_daily_checkins_user_date", "daily_checkins", type_="unique")
    op.drop_column("daily_checkins", "is_completed")
    op.drop_column("daily_checkins", "kpt_try")
    op.drop_column("daily_checkins", "kpt_problem")
    op.drop_column("daily_checkins", "kpt_keep")
    op.drop_column("daily_checkins", "selected_patterns")

    op.alter_column(
        "calendar_events",
        "title",
        existing_type=sa.VARCHAR(length=100),
        nullable=True,
    )

    op.drop_index(op.f("ix_report_review_logs_id"), table_name="report_review_logs")
    op.drop_table("report_review_logs")
    op.drop_index(op.f("ix_report_evidence_trace_id"), table_name="report_evidence_trace")
    op.drop_table("report_evidence_trace")
    op.drop_index(op.f("ix_pattern_candidates_logs_id"), table_name="pattern_candidates_logs")
    op.drop_table("pattern_candidates_logs")
    op.drop_index(op.f("ix_user_stats_id"), table_name="user_stats")
    op.drop_table("user_stats")
    op.drop_index(op.f("ix_user_configs_id"), table_name="user_configs")
    op.drop_table("user_configs")
    op.drop_index(op.f("ix_report_drafts_id"), table_name="report_drafts")
    op.drop_table("report_drafts")
    op.drop_index(op.f("ix_pattern_candidates_daily_id"), table_name="pattern_candidates_daily")
    op.drop_table("pattern_candidates_daily")
    op.drop_index(op.f("ix_daily_snap_shots_id"), table_name="daily_snap_shots")
    op.drop_table("daily_snap_shots")
    op.drop_index(op.f("ix_titles_master_id"), table_name="titles_master")
    op.drop_table("titles_master")
    op.drop_index(op.f("ix_onboarding_options_master_id"), table_name="onboarding_options_master")
    op.drop_table("onboarding_options_master")
    op.drop_index(op.f("ix_expert_knowledge_id"), table_name="expert_knowledge")
    op.drop_table("expert_knowledge")
    op.drop_index(op.f("ix_category_master_id"), table_name="category_master")
    op.drop_table("category_master")
