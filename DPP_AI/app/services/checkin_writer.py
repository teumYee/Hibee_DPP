"""
checkin_writer.py — GPT-4o-mini로 체크인 패턴 후보 생성
입력: snapshot(오늘 데이터), user_configs(사용자 설정), rewrite_instructions(선택)
출력: { "date": "...", "pattern_candidates": [...] }
"""
import os
import json
import logging
from typing import Any, Dict

from openai import OpenAI

logger = logging.getLogger("dpp_ai")

DEFAULT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """당신은 디지털 웰빙 앱 "돌핀팟"의 데일리 체크인 패턴 생성 AI입니다.
입력(snapshot, user_configs)을 바탕으로 사용자가 인지해볼 만한 "사용 패턴 후보"만 제안합니다.

[규칙]
- 패턴 후보는 0~5개. 의미 있는 패턴이 없으면 빈 배열을 반환합니다. 개수를 채우기 위해 억지로 만들지 않습니다.
- candidate_id는 반드시 c1, c2, c3, c4, c5 중 사용한 개수만큼만 사용합니다.
- 판단·평가·훈계·조언·진단은 하지 않습니다. "가능성 제시"와 "이렇게 바라볼 수도 있다" 수준으로만 씁니다.
- 각 후보에 evidence를 반드시 포함합니다. evidence 안에 metrics_used(배열), numbers(배열)를 필수로 넣습니다. dashboard에 존재하는 수치만 사용합니다.
- tags는 2~4개의 짧은 태그 배열로 넣습니다.
- observation·interpretation에는 초(sec) 단위를 쓰지 않고, 분·시간 등 사용자 친화 단위로만 씁니다. 원본 초 값은 evidence.numbers에만 넣습니다.
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


def generate_pattern_candidates(
    snapshot: dict,
    user_configs: dict,
    *,
    rewrite_instructions: list[str] | None = None,
) -> dict:
    """
    GPT-4o-mini로 체크인 패턴 후보 0~5개를 생성합니다.

    Args:
        snapshot: 오늘의 사용 데이터 (date, dashboard 등)
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
            "user_configs": user_configs,
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
    out_candidates: list = []
    for i, c in enumerate(candidates[:5]):
        if not isinstance(c, dict):
            continue
        c = dict(c)
        c["candidate_id"] = f"c{i + 1}"
        out_candidates.append(c)

    return {"date": date, "pattern_candidates": out_candidates}
