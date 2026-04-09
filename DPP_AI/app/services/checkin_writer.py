"""
checkin_writer.py — GPT-4o-mini로 체크인 패턴 후보 생성
입력: snapshot(오늘 데이터), behavior_breakdown, time_policy, user_configs, retrieved_evidence, rewrite_instructions(선택)
출력: { "date": "...", "pattern_candidates": [...] }
"""
import os
import json
import logging
import re
from re import Match
from typing import Any, Dict, List, Optional

from openai import OpenAI

logger = logging.getLogger("dpp_ai")

DEFAULT_MODEL = "gpt-4o-mini"
SEC_WITH_UNIT_PATTERN = re.compile(r"(\d+)\s*(초|sec|seconds?)", re.IGNORECASE)
ADVICE_LIKE_PATTERN = re.compile(
    r"(해야\s*해|해야\s*함|해야\s*합니다|해보세요|권장|추천|줄이세요|늘리세요|해결|습관을\s*바꿔|하도록)",
    re.IGNORECASE,
)
CLINICAL_LANGUAGE_PATTERN = re.compile(
    r"(중독(?:자|적(?:인)?)?|의존성|의존|진단|치료|인지행동치료|CBT|addiction|addictive|dependency|dependence|diagnosis|diagnostic|treatment|therapy|clinical)",
    re.IGNORECASE,
)
CLINICAL_LANGUAGE_REPLACEMENTS = (
    (re.compile(r"중독(?:자|적(?:인)?)?", re.IGNORECASE), "집중되는 사용 흐름"),
    (re.compile(r"의존성|의존", re.IGNORECASE), "자주 열게 되는 경향"),
    (re.compile(r"진단|diagnosis|diagnostic", re.IGNORECASE), "해석"),
    (re.compile(r"치료|인지행동치료|CBT|treatment|therapy|clinical", re.IGNORECASE), "전문 자료"),
    (re.compile(r"addiction|addictive", re.IGNORECASE), "집중되는 사용 흐름"),
    (re.compile(r"dependency|dependence", re.IGNORECASE), "자주 열게 되는 경향"),
)

SYSTEM_PROMPT = """당신은 디지털 웰빙 앱 "돌핀팟"의 데일리 체크인 패턴 생성 AI입니다.
입력(snapshot, behavior_breakdown, time_policy, user_configs, retrieved_evidence)을 바탕으로 사용자가 인지해볼 만한 "사용 패턴 후보"만 제안합니다.

[규칙]
- 패턴 후보는 0~5개. 의미 있는 패턴이 없으면 빈 배열을 반환합니다. 개수를 채우기 위해 억지로 만들지 않습니다.
- candidate_id는 반드시 c1, c2, c3, c4, c5 중 사용한 개수만큼만 사용합니다.
- 판단·평가·훈계·조언·진단은 하지 않습니다. "가능성 제시"와 "이렇게 바라볼 수도 있다" 수준으로만 씁니다.
- 각 후보에 evidence를 반드시 포함합니다. evidence 안에 metrics_used(배열), numbers(배열)를 필수로 넣습니다. dashboard에 존재하는 수치만 사용합니다.
- tags는 2~4개의 짧은 태그 배열로 넣습니다.
- behavior_breakdown.per_app, per_category, time_distribution, top_apps가 있으면 우선 활용합니다.
- 앱/카테고리/시간대 근거를 observation과 interpretation의 핵심 재료로 삼습니다.
- time_policy.logical_date, checkin_time, day_rollover_time을 참고해 날짜와 밤 시간 해석 기준을 고정합니다.
- retrieved_evidence는 행동 패턴 해석의 보조 근거로만 활용합니다. retrieved_evidence가 1개 이상 있으면 interpretation에는 expert 자료와 연결되는 한 문장을 반드시 포함합니다.
- retrieved_evidence에 임상·치료 용어(예: 중독, 중독자, 의존성, 진단, 치료, CBT 등)가 포함되어 있어도 observation과 interpretation에 그 용어를 그대로 복사하지 않습니다.
  retrieved_evidence는 행동 패턴의 배경 원리를 이해하는 데만 활용하고, 사용자에게 전달하는 문장은 반드시 중립적·서술적 표현으로 다시 풀어 씁니다.
  예: "중독적인 사용 패턴" 대신 "특정 시간대에 집중되는 사용 리듬", "앱 의존성" 대신 "자주 열게 되는 앱 패턴"
- retrieved_evidence에 있더라도 snapshot / behavior_breakdown에 없는 사실이나 수치를 새로 만들면 안 됩니다.
- [절대 금지] observation과 interpretation 필드에 초(sec, second, 초) 단위 숫자를 절대 쓰지 않습니다.
  예: 16200초 (X) → 4시간 30분 (O), 2700초 (X) → 45분 (O)
  원본 초 값은 evidence.numbers 배열에만 넣습니다. 이 규칙을 어기면 출력 전체가 무효 처리됩니다.
- 행동 추천, 해결책, "해야 해", "권장", "줄이세요" 등 조언형 표현은 사용하지 않습니다.
- rewrite_instructions가 주어지면 이전 초안의 문제를 모두 반영해 수정합니다. 수정 지시를 우선하고, 같은 위반을 반복하지 않습니다.

[출력 형식 — JSON만 출력, 설명/주석 금지]
{
  "date": "<snapshot의 날짜 문자열 그대로>",
  "pattern_candidates": [
    {
      "candidate_id": "c1",
      "label": "짧은 제목",
      "observation": "관찰된 사실(수치 근거 포함, 분/시간 단위)",
      "interpretation": "하나의 해석 가능성(단정·조언 없음)",
      "evidence": {
        "metrics_used": ["지표명1", "지표명2"],
        "numbers": [숫자, ...]
      },
      "tags": ["태그1", "태그2", "태그3"]
    }
  ]
}
"""


def _format_duration_without_seconds(total_seconds: int) -> str:
    if total_seconds <= 0:
        return "0분"
    if total_seconds < 60:
        return "1분 미만"
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    if hours and minutes:
        return f"{hours}시간 {minutes}분"
    if hours:
        return f"{hours}시간"
    return f"{minutes}분"


def _replace_seconds(text: str) -> str:
    def repl(match: Match[str]) -> str:
        return _format_duration_without_seconds(int(match.group(1)))

    return SEC_WITH_UNIT_PATTERN.sub(repl, text)


def _neutralize_advice(text: str, fallback: str) -> str:
    if not isinstance(text, str):
        return fallback
    cleaned = text.strip()
    if not cleaned:
        return fallback
    if ADVICE_LIKE_PATTERN.search(cleaned):
        return fallback
    return cleaned


def _neutralize_clinical_language(text: str, fallback: str) -> str:
    if not isinstance(text, str):
        return fallback
    cleaned = text.strip()
    if not cleaned:
        return fallback
    neutralized = cleaned
    for pattern, replacement in CLINICAL_LANGUAGE_REPLACEMENTS:
        neutralized = pattern.sub(replacement, neutralized)
    if CLINICAL_LANGUAGE_PATTERN.search(neutralized):
        return fallback
    return neutralized


def _attach_evidence_context(
    text: str, retrieved_evidence: Optional[List[Dict[str, Any]]] = None
) -> str:
    cleaned = str(text or "").strip()
    if not retrieved_evidence:
        return cleaned
    evidence_cues = ("전문 자료", "자료에서도", "알려져", "보고돼")
    if any(cue in cleaned for cue in evidence_cues):
        return cleaned
    suffix = " 전문 자료에서도 이런 사용 리듬을 스스로 알아차리는 과정이 자기인식에 중요한 신호로 다뤄져요."
    return f"{cleaned}{suffix}".strip()


def _sanitize_candidate(
    candidate: Dict[str, Any],
    retrieved_evidence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    sanitized = dict(candidate)
    sanitized["label"] = _replace_seconds(str(candidate.get("label") or "").strip())
    sanitized["observation"] = _neutralize_advice(
        _neutralize_clinical_language(
            _replace_seconds(str(candidate.get("observation") or "").strip()),
            "사용 흐름에서 눈에 띄는 패턴이 있었어요.",
        ),
        "사용 흐름에서 눈에 띄는 패턴이 있었어요.",
    )
    sanitized["interpretation"] = _neutralize_advice(
        _neutralize_clinical_language(
            _replace_seconds(str(candidate.get("interpretation") or "").strip()),
            "이 리듬이 하루 사용 패턴에 영향을 준 것으로 보일 수 있어요.",
        ),
        "이 리듬이 하루 사용 패턴에 영향을 준 것으로 보일 수 있어요.",
    )
    sanitized["interpretation"] = _attach_evidence_context(
        sanitized["interpretation"],
        retrieved_evidence,
    )

    evidence = candidate.get("evidence")
    if not isinstance(evidence, dict):
        evidence = {}
    metrics_used = evidence.get("metrics_used")
    numbers = evidence.get("numbers")
    sanitized["evidence"] = {
        "metrics_used": metrics_used if isinstance(metrics_used, list) else [],
        "numbers": numbers if isinstance(numbers, list) else [],
    }

    tags = candidate.get("tags")
    sanitized["tags"] = tags if isinstance(tags, list) else []
    return sanitized


def generate_pattern_candidates(
    snapshot: Dict[str, Any],
    user_configs: Dict[str, Any],
    *,
    behavior_breakdown: Optional[Dict[str, Any]] = None,
    time_policy: Optional[Dict[str, Any]] = None,
    retrieved_evidence: Optional[List[Dict[str, Any]]] = None,
    rewrite_instructions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    GPT-4o-mini로 체크인 패턴 후보 0~5개를 생성합니다.

    Args:
        snapshot: 오늘의 사용 데이터 요약
        behavior_breakdown: 앱/카테고리/시간대 세부 breakdown
        time_policy: logical_date와 체크인 시간 정책
        user_configs: 사용자 설정 (user_profile, 목표 등)

    Returns:
        {"date": "...", "pattern_candidates": [...]}
        API 예외 시 date는 snapshot에서 추출, pattern_candidates는 []로 반환.
    """
    fallback_date = (snapshot.get("date") or "").strip() if isinstance(snapshot, dict) else ""
    fallback = {"date": fallback_date, "pattern_candidates": []}

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_PATTERN_MODEL", DEFAULT_MODEL)

        payload = {
            "snapshot": snapshot,
            "behavior_breakdown": behavior_breakdown or {},
            "time_policy": time_policy or {},
            "user_configs": user_configs,
            "retrieved_evidence": retrieved_evidence or [],
            "rewrite_instructions": rewrite_instructions or [],
        }
        user_content = json.dumps(payload, ensure_ascii=False)

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
        logger.warning("checkin_writer API failed: %s", e)
        return fallback

    if not raw:
        return fallback

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("checkin_writer JSON parse failed: %s", e)
        return fallback

    if not isinstance(data, dict):
        return fallback

    date = data.get("date")
    if not isinstance(date, str):
        date = fallback_date
    candidates = data.get("pattern_candidates")
    if not isinstance(candidates, list):
        candidates = []

    # c1~c5 형식 및 최대 5개 보정
    out_candidates: List[Dict[str, Any]] = []
    for i, c in enumerate(candidates[:5]):
        if not isinstance(c, dict):
            continue
        c = _sanitize_candidate(c, retrieved_evidence)
        c["candidate_id"] = f"c{i + 1}"
        out_candidates.append(c)

    return {"date": date, "pattern_candidates": out_candidates}
