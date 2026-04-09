#!/usr/bin/env python3
"""
RAG(expert_knowledge) end-to-end 검증.

- DB(DATABASE_URL) 없음: 로그만 출력하고 정상 종료
- DB 있음: expert_knowledge 행 수, retrieve_checkin_evidence / retrieve_report_evidence 결과 검증
"""
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv(override=True)

from typing import Any, Dict, List, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))



from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.database import SessionLocal
from app.services.evidence_retrieval import retrieve_checkin_evidence, retrieve_report_evidence

# test_pipeline.py 의 SAMPLE_INPUT / SAMPLE_INPUT_REPORT 와 동일 (import 순환·부작용 방지)
SAMPLE_INPUT = {
    "snapshot": {
        "date": "2026-03-05",
        "total_usage_sec": 16200,
        "unlock_count": 23,
        "time_of_day_buckets_sec": {"morning": 3600, "afternoon": 5400, "evening": 4200},
        "max_continuous_sec": 2700,
    },
    "user_configs": {"daily_goal_sec": 14400},
}

SAMPLE_INPUT_REPORT = {
    "snapshot": {
        "date": "2026-03-05",
        "total_usage_sec": 16200,
        "unlock_count": 23,
        "app_usage": {
            "Instagram": 3600,
            "YouTube": 5400,
            "KakaoTalk": 2700,
        },
        "time_of_day_buckets_sec": {"morning": 3600, "afternoon": 5400, "evening": 4200},
    },
    "selected_patterns": [
        {"pattern_id": "fragmented", "label": "짧게 자주 켬", "selected": True},
        {"pattern_id": "late_night", "label": "자기 전 30분 집중 사용", "selected": True},
    ],
    "kpt": {
        "keep": "아침에 알림 끄고 집중하는 시간 유지했어",
        "problem": "저녁에 유튜브 보다가 너무 늦게 잠",
        "try": "내일은 11시 이후 폰 뒤집어 두기",
    },
    "retrieved_evidence": [],
}


def _print_header(title: str) -> None:
    line = "═" * 62
    print(f"\n{line}\n  {title}\n{line}")


def _print_kv(label: str, value: object) -> None:
    if isinstance(value, (dict, list)):
        print(f"  {label}:")
        print(json.dumps(value, ensure_ascii=False, indent=4))
    else:
        print(f"  {label}: {value}")


def _summarize_evidence(evidence: List[Dict[str, Any]]) -> None:
    n = len(evidence)
    print(f"  문서 수: {n}")
    for i, doc in enumerate(evidence[:3], 1):
        title = doc.get("title") or doc.get("doc_id")
        src = doc.get("retrieval_sources") or []
        print(f"    [{i}] {title}  sources={src}")
    if n > 3:
        print(f"    … 외 {n - 3}건")


def main() -> int:
    _print_header("RAG end-to-end 검증 (DPP_AI)")

    if SessionLocal is None:
        print("DB 없음 - retrieval skipped")
        return 0

    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY가 없습니다. RAG는 쿼리 플래너·임베딩에 필요합니다. .env를 설정한 뒤 다시 실행하세요.")
        return 1

    session = SessionLocal()
    checks: List[Tuple[str, bool, str]] = []

    try:
        try:
            count = session.execute(text("SELECT COUNT(*) FROM expert_knowledge")).scalar()
        except OperationalError as e:
             print(f"DB 오류: {e}")
             print("DB 없음 - retrieval skipped")
             return 0
        count = int(count or 0)
        ok_count = count > 0
        checks.append(("expert_knowledge COUNT > 0", ok_count, f"count={count}"))

        _print_header("0) expert_knowledge")
        print(f"  COUNT(*): {count}")

        snapshot = SAMPLE_INPUT["snapshot"]
        user_configs_in = SAMPLE_INPUT["user_configs"]
        behavior_breakdown: dict = {}
        time_policy: dict = {}

        _print_header("1) retrieve_checkin_evidence()")
        checkin_result = retrieve_checkin_evidence(
            snapshot,
            behavior_breakdown,
            time_policy,
            user_configs_in,
            db_session=session,
        )
        ev_c = checkin_result.get("retrieved_evidence") or []
        rd_c = checkin_result.get("retrieval_debug") or {}
        ran_c = rd_c.get("retrieval_ran") is True
        checks.append(("checkin: retrieved_evidence 비어 있지 않음", len(ev_c) > 0, f"{len(ev_c)}건"))
        checks.append(("checkin: retrieval_debug.retrieval_ran == True", ran_c, str(rd_c.get("retrieval_ran"))))

        _print_kv("queries", checkin_result.get("queries"))
        _print_kv("retrieval_debug (요약)", {k: rd_c.get(k) for k in ("retrieval_ran", "evidence_count", "query_count", "retrieval_skipped_reason", "used_fallback_retrieval") if k in rd_c})
        _summarize_evidence(ev_c)

        _print_header("2) retrieve_report_evidence()")
        snap_r = SAMPLE_INPUT_REPORT["snapshot"]
        patterns = SAMPLE_INPUT_REPORT["selected_patterns"]
        kpt = SAMPLE_INPUT_REPORT["kpt"]
        user_configs_r: dict = {}

        report_result = retrieve_report_evidence(
            snap_r,
            patterns,
            kpt,
            user_configs_r,
            db_session=session,
        )
        ev_r = report_result.get("retrieved_evidence") or []
        rd_r = report_result.get("retrieval_debug") or {}
        ran_r = rd_r.get("retrieval_ran") is True
        checks.append(("report: retrieved_evidence 비어 있지 않음", len(ev_r) > 0, f"{len(ev_r)}건"))
        checks.append(("report: retrieval_debug.retrieval_ran == True", ran_r, str(rd_r.get("retrieval_ran"))))

        _print_kv("queries", report_result.get("queries"))
        _print_kv("retrieval_debug (요약)", {k: rd_r.get(k) for k in ("retrieval_ran", "evidence_count", "query_count", "retrieval_skipped_reason", "used_fallback_retrieval") if k in rd_r})
        _summarize_evidence(ev_r)

    finally:
        session.close()

    _print_header("검증 요약")
    all_ok = True
    for name, ok, detail in checks:
        status = "PASS" if ok else "FAIL"
        if not ok:
            all_ok = False
        sym = "✓" if ok else "✗"
        print(f"  [{sym}] {status}  {name}")
        print(f"        ({detail})")

    print()
    if all_ok:
        print("  전체 결과: 통과")
        return 0
    print("  전체 결과: 실패 (DB 데이터·pgvector·FTS 인덱스·OPENAI 키 등을 확인하세요)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
