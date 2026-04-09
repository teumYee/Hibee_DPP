import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.checkin_writer import _sanitize_candidate
from app.services.deterministic_check import run_deterministic_check


def test_sanitize_candidate_neutralizes_clinical_terms() -> None:
    candidate = {
        "candidate_id": "c1",
        "label": "야간 사용 흐름",
        "observation": "밤 시간대에 중독적인 사용 패턴이 보였어요.",
        "interpretation": "앱 의존성과 CBT 관점에서는 치료가 필요한 흐름일 수 있어요.",
        "evidence": {"metrics_used": ["total_usage_sec"], "numbers": [16200]},
        "tags": ["야간", "사용리듬"],
    }

    sanitized = _sanitize_candidate(candidate, retrieved_evidence=[{"doc_id": "cbt_ia"}])
    combined = f"{sanitized['observation']} {sanitized['interpretation']}"

    for banned in ("중독", "의존", "진단", "치료", "CBT"):
        assert banned not in combined


def test_deterministic_check_rejects_clinical_terms_in_user_facing_text() -> None:
    result = run_deterministic_check(
        {
            "date": "2026-03-05",
            "pattern_candidates": [
                {
                    "candidate_id": "c1",
                    "label": "야간 사용 흐름",
                    "observation": "중독적인 사용 패턴이 밤에 집중됐어요.",
                    "interpretation": "앱 의존성이 보이는 흐름일 수 있어요.",
                    "evidence": {
                        "metrics_used": ["total_usage_sec", "max_continuous_sec"],
                        "numbers": [16200, 2700],
                    },
                    "tags": ["야간", "집중"],
                }
            ],
        }
    )

    assert result["passed"] is False
    assert any("clinical language detected" in error for error in result["errors"])
