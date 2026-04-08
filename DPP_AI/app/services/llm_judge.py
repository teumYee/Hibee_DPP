"""
llm_judge.py — GPT-4o-mini로 체크인 패턴 질적 평가 (PASS / RETRY / FAIL)
입력: pattern_candidates (writer 출력 또는 후보 dict)
출력: verdict, reasons, fix_instructions, violations
"""
import os
import json
import logging
from typing import Any, Dict, List

from openai import OpenAI

logger = logging.getLogger("dpp_ai")

DEFAULT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """너는 돌핀팟 "체크인 검수자"다.
오직 규칙 위반 여부만 판단한다.
한국어로 출력한다.
반드시 JSON만 출력한다. (설명/주석/여분 텍스트 금지)

━━━━━━━━━━━━━━━━━━━━
[검수 목적]
━━━━━━━━━━━━━━━━━━━━
이 단계는 사용자가 자신의 하루를 새로운 관점에서 인지하도록 돕는 단계다.

interpretation에서는
패턴의 가능성 있는 원인, 맥락, 영향에 대한 설명이 허용된다.
다만, 직접적인 해결책 제시는 허용되지 않는다.

━━━━━━━━━━━━━━━━━━━━
[허용 범위]
━━━━━━━━━━━━━━━━━━━━
- "도움이 되는 시간대일 수 있음"
- "목표 달성에 도전이 될 수 있음"
- "점검해볼 가치가 있음"
- 사용 리듬이나 맥락에 대한 가능성 설명

━━━━━━━━━━━━━━━━━━━━
[위반으로 간주하는 항목]
━━━━━━━━━━━━━━━━━━━━
1) 단정적 평가

2) 직접적 해결책 제시

3) 의학적/임상적 진단

4) dashboard에 존재하지 않는 수치 생성

5) 비정상적인 수치 단위

6) evidence(metrics_used, numbers) 누락

7) 패턴 간 의미상 거의 동일한 반복

8) retrieved_evidence가 1개 이상인데 interpretation에 expert 근거 연결이 전혀 드러나지 않음

━━━━━━━━━━━━━━━━━━━━
[판정 기준]
━━━━━━━━━━━━━━━━━━━━
- PASS: 규칙 위반 없음
- RETRY: 일부 문장 수정으로 해결 가능
- FAIL: 구조가 심각하게 깨졌거나 규칙을 전반적으로 위반

━━━━━━━━━━━━━━━━━━━━
[출력 형식(JSON only)]
━━━━━━━━━━━━━━━━━━━━
{
  "verdict": "PASS" | "RETRY" | "FAIL",
  "reasons": ["..."],
  "fix_instructions": ["..."],
  "violations": {
    "hallucinated_numbers": false,
    "judgmental_tone": false,
    "advice_present": false,
    "time_rule_violation": false,
    "missing_evidence": false,
    "duplicates": false
  }
}
"""

DEFAULT_VIOLATIONS = {
    "hallucinated_numbers": False,
    "judgmental_tone": False,
    "advice_present": False,
    "time_rule_violation": False,
    "missing_evidence": False,
    "duplicates": False,
    "evidence_ignored": False,
}


def _interpretations_reference_evidence(
    pattern_candidates: Dict[str, Any],
    retrieved_evidence: List[Dict[str, Any]] | None,
) -> bool:
    if not retrieved_evidence:
        return True
    candidates = pattern_candidates.get("pattern_candidates") or []
    if not isinstance(candidates, list):
        return False
    joined = " ".join(str(item.get("interpretation") or "") for item in candidates if isinstance(item, dict))
    lowered = joined.lower()
    return any(cue in lowered for cue in ("전문 자료", "자료에서도", "자기인식", "알려져", "보고돼"))


def run_llm_judge(
    pattern_candidates: dict,
    *,
    snapshot: dict | None = None,
    retrieved_evidence: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """
    체크인 검수자 시스템 프롬프트로 GPT-4o-mini를 호출해 규칙 위반 여부를 판단합니다.

    Args:
        pattern_candidates: writer 출력 전체(dict) 또는 pattern_candidates 배열을 담은 dict.
        snapshot: 체크인 스냅샷 원본(선택)
        retrieved_evidence: 검색된 근거 목록(선택)

    Returns:
        {
            "verdict": "PASS" | "RETRY" | "FAIL",
            "reasons": ["..."],
            "fix_instructions": ["..."],
            "violations": { "hallucinated_numbers": bool, ... },
            "raw": "..."  # 파싱 실패 시에도 있으면 포함
        }
        파싱 실패 시 verdict는 "FAIL", reasons 등은 빈 값/기본값으로 반환.
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = os.getenv("OPENAI_JUDGE_MODEL", DEFAULT_MODEL)

    payload = {
        "pattern_candidates": pattern_candidates,
        "snapshot": snapshot or {},
        "retrieved_evidence": retrieved_evidence or [],
    }
    user_content = json.dumps(payload, ensure_ascii=False)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = (response.choices[0].message.content or "").strip()
    except Exception as e:
        logger.warning("llm_judge API call failed: %s", e)
        return {
            "verdict": "FAIL",
            "reasons": [str(e)],
            "fix_instructions": [],
            "violations": dict(DEFAULT_VIOLATIONS),
            "raw": "",
        }

    if not raw:
        return {
            "verdict": "FAIL",
            "reasons": ["Empty judge output"],
            "fix_instructions": [],
            "violations": dict(DEFAULT_VIOLATIONS),
            "raw": "",
        }

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("llm_judge JSON parse failed: %s", e)
        return {
            "verdict": "FAIL",
            "reasons": [f"JSON parse error: {e}"],
            "fix_instructions": [],
            "violations": dict(DEFAULT_VIOLATIONS),
            "raw": raw,
        }

    verdict = (data.get("verdict") or "FAIL").strip().upper()
    if verdict not in ("PASS", "RETRY", "FAIL"):
        verdict = "FAIL"

    reasons = data.get("reasons")
    if not isinstance(reasons, list):
        reasons = [str(reasons)] if reasons else []

    fix_instructions = data.get("fix_instructions")
    if not isinstance(fix_instructions, list):
        fix_instructions = []

    violations = data.get("violations")
    if not isinstance(violations, dict):
        violations = dict(DEFAULT_VIOLATIONS)
    else:
        for key in DEFAULT_VIOLATIONS:
            if key not in violations:
                violations[key] = DEFAULT_VIOLATIONS[key]
        # 여분 키는 제거하지 않고 그대로 둠 (호환용)

    if retrieved_evidence and not _interpretations_reference_evidence(pattern_candidates, retrieved_evidence):
        reasons.append("retrieved_evidence가 있는데 interpretation에 expert 근거 연결이 드러나지 않습니다.")
        fix_instructions.append("각 interpretation에 expert 자료와 연결되는 일반 원칙을 한 문장 이상 자연스럽게 반영하세요.")
        violations["evidence_ignored"] = True
        if verdict == "PASS":
            verdict = "RETRY"

    return {
        "verdict": verdict,
        "reasons": reasons,
        "fix_instructions": fix_instructions,
        "violations": violations,
        "raw": raw,
    }
