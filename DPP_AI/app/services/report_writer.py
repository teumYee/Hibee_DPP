"""
report_writer.py — Claude Sonnet으로 데일리 리포트 작성
입력: snapshot, selected_patterns, kpt [, retrieved_evidence]
출력: { "report_markdown": "..." }
retrieved_evidence는 파라미터로 받되 비어 있어도 동작 (나중에 DB 연동 시 사용)
"""
import os
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("dpp_ai")

# 환경변수: ANTHROPIC_API_KEY, REPORT_WRITER_MODEL (기본 claude-sonnet-4-6)
DEFAULT_MODEL = "claude-sonnet-4-6"
FALLBACK_MODEL = "claude-opus-4-6"  # 3회차 재시도용

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None


def _call_claude(
    system: str,
    user_content: str,
    *,
    model: str,
) -> str:
    """Anthropic Messages API 호출. 실패 시 예외."""
    if Anthropic is None:
        raise RuntimeError("anthropic 패키지가 필요합니다. pip install anthropic")
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    resp = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    text = (resp.content[0].text if resp.content else "").strip()
    return text


def generate_report(
    snapshot: dict,
    selected_patterns: List[Dict[str, Any]],
    kpt: dict,
    *,
    retrieved_evidence: Optional[List[Any]] = None,
    rewrite_brief: Optional[str] = None,
    use_opus: bool = False,
) -> dict:
    """
    Claude로 데일리 리포트 초안을 생성합니다.

    Args:
        snapshot: 오늘 사용 데이터 스냅샷
        selected_patterns: 사용자가 선택한 패턴 리스트
        kpt: KPT 등 추가 컨텍스트
        retrieved_evidence: 검색된 근거 목록. 비어 있거나 None이면 무시 (placeholder)
        rewrite_brief: 검수 피드백(재작성 시에만 전달)
        use_opus: True면 Opus 모델 사용 (3회차 fallback용)

    Returns:
        {"report_markdown": "..."}
    """
    if retrieved_evidence is None:
        retrieved_evidence = []

    model = os.getenv("REPORT_WRITER_MODEL_OPUS", FALLBACK_MODEL) if use_opus else os.getenv("REPORT_WRITER_MODEL", DEFAULT_MODEL)

    system = """[역할]
돌핀팟 데일리 리포트 작성 AI.
사용자의 스마트폰 사용 스냅샷과 체크인 결과를 바탕으로,
자기인식을 돕는 마크다운 리포트를 생성한다.

[입력 필드 활용 방식]
- snapshot: 총 사용시간, 앱별 사용시간, 주요 수치 → 리포트 전반의 사실 근거
- selected_patterns: 사용자가 직접 선택한 오늘의 패턴 (e.g. 집중 시간대, 주로 쓴 앱 유형) → 2~3줄 맥락 서술에 활용
- kpt.keep / kpt.problem / kpt.try: 사용자가 직접 작성한 회고 → 요약·인정 형태로 반영
- retrieved_evidence: 비어있으면 무시. 있으면 관련 항목을 "참고" 형태로 자연스럽게 언급 (출처 인용 X)
- rewrite_brief: 있으면 반드시 반영. 없으면 무시.

[리포트 마크다운 구조 — 반드시 이 순서로]
## 오늘의 사용 요약
(snapshot 기반 수치 + selected_patterns 맥락 2~3문장)

## 체크인 돌아보기
(kpt keep/problem/try 각각 1~2문장으로 인정·요약)

## 내일을 위한 한 가지
(try 바탕으로 실행 가능한 작은 제안 1개만. 강요 금지)

[절대 금지]
- snapshot에 없는 수치 생성
- "해야 합니다" "반드시" 등 지시형 표현
- 비난·훈계·평가 톤
- 의료·심리 진단
- 3개 이상 조언 나열

[출력]
마크다운 텍스트만. JSON 래핑 없이."""

    payload = {
        "snapshot": snapshot,
        "selected_patterns": selected_patterns,
        "kpt": kpt,
        "retrieved_evidence": retrieved_evidence,
    }
    if rewrite_brief:
        payload["rewrite_brief"] = rewrite_brief
    user_content = json.dumps(payload, ensure_ascii=False)

    try:
        raw = _call_claude(system, user_content, model=model)
    except Exception as e:
        logger.warning("report_writer API failed: %s", e)
        raise

    if not raw:
        return {"report_markdown": ""}

    # 마크다운 그대로 반환 (JSON 래핑 없이도 가능하지만, 응답 형식 통일을 위해 객체로)
    return {"report_markdown": raw}
