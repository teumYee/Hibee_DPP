"""trim whitespace in onboarding option json values

Revision ID: 20260325_trim_option_json
Revises: 20260325_onboard_jsonb
Create Date: 2026-03-25 00:10:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260325_trim_option_json"
down_revision: Union[str, Sequence[str], None] = "20260325_onboard_jsonb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        r"""
        UPDATE onboarding_options_master
        SET option_text = (
            SELECT to_jsonb(
                ARRAY(
                    SELECT btrim(value, E' \n\r\t')
                    FROM jsonb_array_elements_text(option_text) AS value
                    WHERE NULLIF(btrim(value, E' \n\r\t'), '') IS NOT NULL
                )
            )
        )
        WHERE option_text IS NOT NULL
          AND jsonb_typeof(option_text) = 'array';
        """
    )

    op.execute(
        r"""
        UPDATE category_master
        SET option_text = to_jsonb(btrim(option_text #>> '{}', E' \n\r\t'))
        WHERE option_text IS NOT NULL
          AND jsonb_typeof(option_text) = 'string';
        """
    )


def downgrade() -> None:
    pass
