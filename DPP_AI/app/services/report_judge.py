"""
report_judge.py — GPT-4o-mini로 리포트 검수
입력: report_draft, snapshot, kpt, retrieved_evidence
출력: { verdict: PASS|REWRITE|FALLBACK, issues[], rewrite_brief }
할루시네이션/톤/과잉조언/포맷 위반 점검
"""
import os
import json
import logging
from typing import Any, Dict, List, Optional

from openai import OpenAI

logger = logging.getLogger("dpp_ai")

DEFAULT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """당신은 돌핀팟 "데일리 리포트 검수자"입니다.
리포트 초안(report_draft)이 snapshot·kpt·retrieved_evidence와 일치하는지, 규칙 위반이 없는지 판단합니다.

[점검 항목]
1) 할루시네이션: snapshot에 없는 수치·사실을 만들지 않았는지
2) 근거 일치: retrieved_evidence에 없는 주장이나, 근거와 어긋나는 해석을 단정적으로 쓰지 않았는지
3) 톤: 비난·과도한 단정이 없는지
4) 과잉 조언: 해결책·권장·"해야 해" 등이 과하지 않은지
5) 포맷: 마크다운 구조가 깨지지 않았는지

[근거 사용 원칙]
- retrieved_evidence는 리포트의 외부 근거다.
- snapshot, kpt, retrieved_evidence 어디에도 없는 내용은 사실처럼 쓰면 안 된다.
- 근거가 약하면 PASS 대신 REWRITE 또는 FALLBACK을 선택한다.
- retrieved_evidence가 비어 있으면, snapshot/kpt 범위를 넘는 일반화나 단정은 더 엄격하게 본다.

[판정]
- PASS: 위반 없음, 그대로 사용 가능
- REWRITE: 일부 수정으로 개선 가능 (issues·rewrite_brief로 지적)
- FALLBACK: 구조적 문제 또는 전반적 위반으로 재작성보다 템플릿 폴백 권장

[출력 형식 — JSON만]
{
  "verdict": "PASS" | "REWRITE" | "FALLBACK",
  "issues": ["지적1", "지적2"],
  "rewrite_brief": "작성자에게 전달할 수정 요약 (REWRITE일 때만 구체적으로)"
}
"""


def run_report_judge(
    report_draft: str,
    snapshot: dict,
    kpt: dict,
    *,
    retrieved_evidence: List[Dict[str, Any]] | None = None,
    model: str | None = None,
) -> Dict[str, Any]:
    """
    리포트 초안을 검수합니다.

    Args:
        report_draft: 리포트 마크다운 문자열
        snapshot: 오늘 스냅샷
        kpt: KPT 컨텍스트
        retrieved_evidence: 검색된 근거 목록
        model: 사용 모델 (기본 gpt-4o-mini)

    Returns:
        {
            "verdict": "PASS" | "REWRITE" | "FALLBACK",
            "issues": ["..."],
            "rewrite_brief": "..."
        }
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = model or os.getenv("REPORT_JUDGE_MODEL", DEFAULT_MODEL)
    if retrieved_evidence is None:
        retrieved_evidence = []

    payload = {
        "report_draft": report_draft,
        "snapshot": snapshot,
        "kpt": kpt,
        "retrieved_evidence": retrieved_evidence,
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
        logger.warning("report_judge API failed: %s", e)
        return {
            "verdict": "FALLBACK",
            "issues": [str(e)],
            "rewrite_brief": "",
        }

    if not raw:
        return {"verdict": "FALLBACK", "issues": ["Empty judge output"], "rewrite_brief": ""}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"verdict": "FALLBACK", "issues": ["Judge response not valid JSON"], "rewrite_brief": ""}

    verdict = (data.get("verdict") or "FALLBACK").strip().upper()
    if verdict not in ("PASS", "REWRITE", "FALLBACK"):
        verdict = "FALLBACK"
    issues = data.get("issues")
    if not isinstance(issues, list):
        issues = []
    rewrite_brief = data.get("rewrite_brief") or ""

    return {"verdict": verdict, "issues": issues, "rewrite_brief": rewrite_brief}
