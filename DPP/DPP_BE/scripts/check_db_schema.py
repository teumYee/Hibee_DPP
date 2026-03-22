"""One-off: inspect remote DB vs expectations. Run: python scripts/check_db_schema.py"""
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
url = os.getenv("DATABASE_URL")
if not url:
    print("DATABASE_URL missing in .env")
    sys.exit(1)

engine = create_engine(url, pool_pre_ping=True)

with engine.connect() as conn:
    try:
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        print("alembic_version:", rows)
    except Exception as e:
        print("alembic_version: ERROR", e)

    try:
        rows = conn.execute(
            text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
        ).fetchall()
        print("pgvector extension:", rows if rows else "NOT INSTALLED")
    except Exception as e:
        print("pgvector: ERROR", e)

    tables = [
        "daily_snap_shots",
        "pattern_candidates_daily",
        "pattern_candidates_logs",
        "expert_knowledge",
        "report_drafts",
        "report_evidence_trace",
        "report_review_logs",
        "user_stats",
        "user_configs",
        "titles_master",
    ]
    for t in tables:
        q = text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :n)"
        )
        ex = conn.execute(q, {"n": t}).scalar()
        print(f"table public.{t}: {bool(ex)}")

    try:
        cols = [
            r[0]
            for r in conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'daily_checkins' "
                    "ORDER BY ordinal_position"
                )
            ).fetchall()
        ]
        print("daily_checkins columns:", cols)
        new_kpt = {"selected_patterns", "kpt_keep", "kpt_problem", "kpt_try", "is_completed"}
        old = {"generated_question", "user_answer", "is_answered"}
        print(
            "  -> has new KPT columns:",
            new_kpt.issubset(set(cols)),
            "| has old columns:",
            bool(old & set(cols)),
        )
    except Exception as e:
        print("daily_checkins columns: ERROR", e)
