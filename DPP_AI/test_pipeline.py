#!/usr/bin/env python3
"""POST /ai/checkin-pipeline·/ai/report-pipeline 흐름 테스트 (로깅 포함)."""
import json
import os
import sys

# DPP_AI/app 기준으로 import 가능하도록
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(override=True)

# HTTP 테스트 시 create_app()에서 필요. 없으면 상위 ai-test 또는 현재 디렉터리 사용
if not os.getenv("AI_TEST_ROOT"):
    _parent_ai_test = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai-test")
    os.environ["AI_TEST_ROOT"] = _parent_ai_test if os.path.isdir(_parent_ai_test) else os.path.dirname(__file__)

if not os.getenv("OPENAI_API_KEY"):
    print("OPENAI_API_KEY가 없습니다. .env를 설정한 뒤 다시 실행하세요.")
    sys.exit(1)

from app.services.checkin_pipeline import run_checkin_pipeline
from app.services.report_pipeline import run_report_pipeline

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


def main():
    print("=== checkin-pipeline 테스트 (writer → deterministic_check → llm_judge → 로깅) ===\n")
    result = run_checkin_pipeline(SAMPLE_INPUT, log_to_db=True, db_session=None)
    print("run_id:", result.get("run_id"))
    print("final_verdict:", result.get("final_verdict"))
    print("\n--- writer_output (일부) ---")
    wo = result.get("writer_output") or {}
    print("  date:", wo.get("date"))
    print("  pattern_candidates 개수:", len(wo.get("pattern_candidates") or []))
    if wo.get("pattern_candidates"):
        print("  첫 후보 keys:", list((wo["pattern_candidates"][0] or {}).keys()))
    print("\n--- deterministic_result ---")
    print(json.dumps(result.get("deterministic_result"), ensure_ascii=False, indent=2))
    print("\n--- judge_result (일부) ---")
    jr = result.get("judge_result") or {}
    print("  verdict:", jr.get("verdict"))
    print("  reasons:", jr.get("reasons")[:3] if jr.get("reasons") else [])
    print("\n--- 전체 result (raw 제외) ---")
    out = {k: v for k, v in result.items() if k != "writer_output" or not v}
    if result.get("writer_output"):
        out["writer_output"] = {
            "date": result["writer_output"].get("date"),
            "pattern_candidates_count": len(result["writer_output"].get("pattern_candidates") or []),
        }
    if result.get("judge_result") and "raw" in result["judge_result"]:
        jr_copy = dict(result["judge_result"])
        jr_copy.pop("raw", None)
        out["judge_result"] = jr_copy
    else:
        out["judge_result"] = result.get("judge_result")
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print("\n테스트 완료.")


def test_http_endpoint():
    """POST /ai/checkin-pipeline HTTP 엔드포인트 테스트."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.post("/ai/checkin-pipeline", json=SAMPLE_INPUT)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "run_id" in data and "final_verdict" in data
    assert data.get("writer_output", {}).get("date") == "2026-03-05"
    print("POST /ai/checkin-pipeline HTTP 테스트 통과.")


def test_report_pipeline_direct():
    """run_report_pipeline() 직접 호출 (Claude writer + judge)."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY가 없어서 test_report_pipeline_direct 건너뜀.")
        return
    print("=== report-pipeline 테스트 (report_writer → report_judge → 로깅) ===\n")
    result = run_report_pipeline(SAMPLE_INPUT_REPORT, log_to_db=True, db_session=None)
    print("run_id:", result.get("run_id"))
    print("final_verdict:", result.get("final_verdict"))
    print("attempts:", result.get("attempts"))
    print("used_fallback_template:", result.get("used_fallback_template"))
    judge_results = result.get("judge_results") or []
    if judge_results:
        print("judge verdicts:", [jr.get("verdict") for jr in judge_results])
    print("\nreport-pipeline 직접 호출 테스트 완료.\n")


def test_report_http_endpoint():
    """POST /ai/report-pipeline HTTP 엔드포인트 테스트."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.post("/ai/report-pipeline", json=SAMPLE_INPUT_REPORT)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "run_id" in data and "final_verdict" in data
    print("POST /ai/report-pipeline HTTP 테스트 통과.")


if __name__ == "__main__":
    main()
    test_http_endpoint()
    test_report_pipeline_direct()
    test_report_http_endpoint()
