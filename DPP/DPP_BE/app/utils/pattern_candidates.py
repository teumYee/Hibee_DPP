from typing import Any, Dict, List


def normalize_pattern_candidates(raw_candidates: Any) -> List[dict]:
    """AI 파이프라인·DB JSONB에 저장된 패턴 후보 리스트를 공통 형태로 정규화한다."""
    if not isinstance(raw_candidates, list):
        return []

    normalized: List[dict] = []
    for item in raw_candidates:
        if not isinstance(item, dict):
            continue

        candidate = dict(item)
        label = str(candidate.get("label") or "").strip()
        observation = str(candidate.get("observation") or "").strip()
        interpretation = str(candidate.get("interpretation") or "").strip()

        if label and not candidate.get("title"):
            candidate["title"] = label
        if not candidate.get("description"):
            candidate["description"] = interpretation or observation

        evidence = candidate.get("evidence")
        if not isinstance(evidence, dict):
            candidate["evidence"] = {"metrics_used": [], "numbers": []}
        else:
            evidence = dict(evidence)
            if not isinstance(evidence.get("metrics_used"), list):
                evidence["metrics_used"] = []
            if not isinstance(evidence.get("numbers"), list):
                evidence["numbers"] = []
            candidate["evidence"] = evidence

        if not isinstance(candidate.get("tags"), list):
            candidate["tags"] = []

        normalized.append(candidate)

    return normalized
