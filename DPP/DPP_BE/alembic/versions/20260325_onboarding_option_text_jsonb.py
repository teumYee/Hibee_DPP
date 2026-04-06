"""convert onboarding option text columns to jsonb

Revision ID: 20260325_onboard_jsonb
Revises: 20260324_snapshot_v3
Create Date: 2026-03-25 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260325_onboard_jsonb"
down_revision: Union[str, Sequence[str], None] = "20260324_snapshot_v3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION parse_legacy_option_text(raw text)
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
            trimmed text;
            inner_text text;
            items text[];
        BEGIN
            IF raw IS NULL THEN
                RETURN NULL;
            END IF;

            trimmed := btrim(raw);
            IF trimmed = '' THEN
                RETURN NULL;
            END IF;

            BEGIN
                RETURN trimmed::jsonb;
            EXCEPTION
                WHEN others THEN
                    NULL;
            END;

            IF left(trimmed, 1) = '[' AND right(trimmed, 1) = ']' THEN
                inner_text := btrim(substr(trimmed, 2, length(trimmed) - 2));

                IF inner_text = '' THEN
                    RETURN '[]'::jsonb;
                END IF;

                items := regexp_split_to_array(inner_text, E'\\s*,\\s*');

                RETURN to_jsonb(
                    ARRAY(
                        SELECT btrim(item, E' \n\r\t')
                        FROM unnest(items) AS item
                        WHERE NULLIF(btrim(item, E' \n\r\t'), '') IS NOT NULL
                    )
                );
            END IF;

            RETURN to_jsonb(trimmed);
        END;
        $$;
        """
    )

    op.alter_column(
        "category_master",
        "option_text",
        existing_type=sa.Text(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="parse_legacy_option_text(option_text)",
    )

    op.alter_column(
        "onboarding_options_master",
        "option_text",
        existing_type=sa.Text(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="parse_legacy_option_text(option_text)",
    )

    op.execute("DROP FUNCTION parse_legacy_option_text(text);")


def downgrade() -> None:
    op.alter_column(
        "onboarding_options_master",
        "option_text",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        existing_nullable=True,
        postgresql_using="""
        CASE
            WHEN option_text IS NULL THEN NULL
            WHEN jsonb_typeof(option_text) = 'string' THEN option_text #>> '{}'
            ELSE option_text::text
        END
        """,
    )

    op.alter_column(
        "category_master",
        "option_text",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        existing_nullable=True,
        postgresql_using="""
        CASE
            WHEN option_text IS NULL THEN NULL
            WHEN jsonb_typeof(option_text) = 'string' THEN option_text #>> '{}'
            ELSE option_text::text
        END
        """,
    )
