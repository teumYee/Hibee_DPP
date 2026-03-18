"""
report_writer.py — Claude Sonnet으로 데일리 리포트 작성
입력: snapshot, selected_patterns, kpt [, retrieved_evidence]
출력: { "report_markdown": "..." }
retrieved_evidence는 파라미터로 받되 비어 있어도 동작 (나중에 DB 연동 시 사용)
"""
import os
import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger("dpp_ai")

# 환경변수: ANTHROPIC_API_KEY, REPORT_WRITER_MODEL (기본 claude-3-5-sonnet)
DEFAULT_MODEL = "claude-3-5-sonnet-20241022"
FALLBACK_MODEL = "claude-3-opus-20240229"  # 3회차 재시도용

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
    retrieved_evidence: List[Any] | None = None,
    rewrite_brief: str | None = None,
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

    system = """당신은 디지털 웰빙 앱 "돌핀팟"의 데일리 리포트 작성 AI입니다.
snapshot과 사용자가 선택한 패턴(selected_patterns), KPT를 바탕으로
사용자에게 전달할 리포트를 마크다운으로 작성합니다.
과잉 조언·훈계를 피하고, 사실과 맥락 위주로 서술합니다."""

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
