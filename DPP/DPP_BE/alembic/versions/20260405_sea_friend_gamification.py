"""add sea friend gamification fields and tables

Revision ID: 20260405_sea_friend_gamification
Revises: 20260325_trim_option_json
Create Date: 2026-04-05 18:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260405_sea_friend_gamification"
down_revision: Union[str, Sequence[str], None] = "20260325_trim_option_json"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("user_stats", "user_id", existing_type=sa.Integer(), nullable=False)
    op.create_unique_constraint("uq_user_stats_user_id", "user_stats", ["user_id"])

    op.add_column("characters", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("characters", sa.Column("species", sa.String(length=50), nullable=True))

    op.add_column("user_characters", sa.Column("display_name", sa.String(length=50), nullable=True))
    op.add_column("user_characters", sa.Column("source_type", sa.String(length=50), nullable=True))
    op.add_column("user_characters", sa.Column("source_key", sa.String(length=100), nullable=True))
    op.add_column("user_characters", sa.Column("source_date", sa.Date(), nullable=True))
    op.add_column("user_characters", sa.Column("source_payload", sa.JSON(), nullable=True))
    op.add_column(
        "user_characters",
        sa.Column("rarity", sa.String(length=20), nullable=False, server_default="common"),
    )
    op.add_column(
        "user_characters",
        sa.Column("is_special", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("user_characters", sa.Column("room_slot", sa.Integer(), nullable=True))
    op.add_column("user_characters", sa.Column("room_position", sa.JSON(), nullable=True))
    op.add_column(
        "user_characters",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
    )

    op.add_column("items", sa.Column("slot_type", sa.String(length=50), nullable=True))
    op.add_column("user_items", sa.Column("equipped_slot", sa.String(length=50), nullable=True))

    op.add_column(
        "user_stats",
        sa.Column("social_representative_character_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_user_stats_social_representative_character_id",
        "user_stats",
        "user_characters",
        ["social_representative_character_id"],
        ["id"],
    )

    op.create_table(
        "character_acquisition_logs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("user_character_id", sa.Integer(), nullable=False),
        sa.Column("grant_type", sa.String(length=50), nullable=False),
        sa.Column("grant_key", sa.String(length=100), nullable=False),
        sa.Column("grant_date", sa.Date(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_character_id"], ["user_characters.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("user_id", "grant_type", "grant_key", name="uq_character_acquisition_user_grant"),
    )


def downgrade() -> None:
    op.drop_table("character_acquisition_logs")

    op.drop_constraint("uq_user_stats_user_id", "user_stats", type_="unique")
    op.alter_column("user_stats", "user_id", existing_type=sa.Integer(), nullable=True)

    op.drop_constraint(
        "fk_user_stats_social_representative_character_id",
        "user_stats",
        type_="foreignkey",
    )
    op.drop_column("user_stats", "social_representative_character_id")

    op.drop_column("user_items", "equipped_slot")
    op.drop_column("items", "slot_type")

    op.drop_column("user_characters", "status")
    op.drop_column("user_characters", "room_position")
    op.drop_column("user_characters", "room_slot")
    op.drop_column("user_characters", "is_special")
    op.drop_column("user_characters", "rarity")
    op.drop_column("user_characters", "source_payload")
    op.drop_column("user_characters", "source_date")
    op.drop_column("user_characters", "source_key")
    op.drop_column("user_characters", "source_type")
    op.drop_column("user_characters", "display_name")

    op.drop_column("characters", "species")
    op.drop_column("characters", "description")
