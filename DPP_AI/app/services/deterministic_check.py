"""
deterministic_check.py — JSON 스키마/수치/금지어 검증 (체크인 후보용)
입력: writer 출력(패턴 후보 JSON)
출력: 검증 결과 { "passed": bool, "errors": [...] }
"""
import re
import logging
from typing import Any, Dict, List, Set

logger = logging.getLogger("dpp_ai")

# 초(sec) 표기 금지 (label / observation / interpretation)
BANNED_SEC = re.compile(
    r"(\d+\s*초|\(\s*\d+\s*초\s*\)|\bsec\b|\bseconds\b)",
    re.IGNORECASE,
)

# 조언/훈계/해결책 느낌 (Judge가 2차로 더 정확히 잡음)
ADVICE_LIKE = re.compile(
    r"(해야\s*해|해야\s*함|해보세요|권장|추천|줄이세요|늘리세요|해결|습관을\s*바꿔|~하도록)"
)
CLINICAL_LANGUAGE = re.compile(
    r"(중독(?:자|적(?:인)?)?|의존성|의존|진단|치료|인지행동치료|CBT|addiction|addictive|dependency|dependence|diagnosis|diagnostic|treatment|therapy|clinical)",
    re.IGNORECASE,
)

# candidate_id 형식: c1 ~ c5
CANDIDATE_ID_PATTERN = re.compile(r"^c[1-5]$")


def run_deterministic_check(output: Dict[str, Any]) -> Dict[str, Any]:
    """
    체크인 후보 JSON에 대한 결정론적 QA 검증.

    - 기본 구조: date(string), pattern_candidates(array, 최대 5개)
    - 각 후보: candidate_id(c1~c5), label/observation/interpretation 필수, 초 표기 금지, 조언형 표현 금지
      observation/interpretation에는 임상·치료 용어 직접 노출 금지
    - evidence.metrics_used, evidence.numbers 배열 필수
    - tags 배열 2~4개
    - label 중복 금지

    Returns:
        검증 실패 시 {"passed": False, "errors": [...]}
        통과 시 {"passed": True, "errors": []}
    """
    errors: List[str] = []
    out = output

    # 0) 기본 구조
    if not out or not isinstance(out, dict):
        return {"passed": False, "errors": ["Output not object"]}
    if not isinstance(out.get("date"), str):
        errors.append("date missing")
    if not isinstance(out.get("pattern_candidates"), list):
        errors.append("pattern_candidates not array")
    else:
        pc = out["pattern_candidates"]
        if len(pc) > 5:
            errors.append("pattern_candidates > 5")

    # 후보 배열이 없거나 형식 오류면 루프 생략
    candidates = out.get("pattern_candidates") if isinstance(out.get("pattern_candidates"), list) else []
    seen_labels: Set[str] = set()

    for c in candidates:
        if not isinstance(c, dict):
            errors.append("pattern_candidates item not object")
            continue

        cid = c.get("candidate_id", "")
        if not CANDIDATE_ID_PATTERN.match(str(cid)):
            errors.append(f"bad candidate_id: {cid}")

        for key in ("label", "observation", "interpretation"):
            val = c.get(key)
            if not isinstance(val, str) or not val.strip():
                errors.append(f"missing {key} in {cid}")
            else:
                if BANNED_SEC.search(val):
                    errors.append(f"seconds mentioned in {key} ({cid})")
                if key in ("observation", "interpretation") and ADVICE_LIKE.search(val):
                    errors.append(f"advice-like language detected ({cid})")
                if key in ("observation", "interpretation") and CLINICAL_LANGUAGE.search(val):
                    errors.append(f"clinical language detected in {key} ({cid})")

        ev = c.get("evidence")
        if not ev or not isinstance(ev, dict):
            errors.append(f"evidence invalid ({cid})")
        else:
            if not isinstance(ev.get("metrics_used"), list) or not isinstance(ev.get("numbers"), list):
                errors.append(f"evidence invalid ({cid})")

        tags = c.get("tags")
        if not isinstance(tags, list) or len(tags) < 2 or len(tags) > 4:
            errors.append(f"tags must be 2~4 ({cid})")

        # label 중복 방지
        label_val = (c.get("label") or "").strip()
        if label_val:
            if label_val in seen_labels:
                errors.append(f"duplicate label detected: {label_val}")
            seen_labels.add(label_val)

    passed = len(errors) == 0
    return {"passed": passed, "errors": errors}
