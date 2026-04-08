"""
report_judge.py — GPT-4o-mini로 리포트 검수
입력: report_draft, snapshot, kpt, retrieved_evidence
출력: { verdict: PASS|REWRITE|FALLBACK, issues[], rewrite_brief }
할루시네이션/톤/과잉조언/포맷 위반 점검
"""
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from openai import OpenAI

logger = logging.getLogger("dpp_ai")

DEFAULT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """당신은 돌핀팟 "데일리 리포트 검수자"입니다.
리포트 초안(report_draft)이 snapshot·kpt·retrieved_evidence와 일치하는지, 규칙 위반이 없는지 판단합니다.

[점검 항목]
1) 할루시네이션: snapshot에 없는 수치·사실을 만들지 않았는지.
   snapshot의 수치를 사람이 읽기 좋은 단위(초→분/시간, 횟수 등)로 변환하는 것은 허용된다.
   16200초를 '4시간 30분'으로 표기하는 것은 정확한 변환이므로 할루시네이션이 아니다.
2) 톤: 비난·과도한 단정이 없는지
3) 과잉 조언: 강제성 있는 처방이 과하지 않은지.
   1개의 부드러운 제안은 허용된다. '~할 수 있어요', '~좋을 수 있어요' 같은 가능성 표현은 과잉 조언이 아니다.
   '반드시', '해야 합니다', '꼭' 같은 강제성 표현이 있을 때만 위반으로 판정한다.
4) 포맷: 마크다운 구조가 깨지지 않았는지
5) evidence 사용: retrieved_evidence가 1개 이상이면 초안에 expert 근거가 최소 1문장 이상 자연스럽게 반영되어야 한다. 완전히 무시하면 REWRITE다.

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

KEYWORD_PATTERN = re.compile(r"[0-9A-Za-z가-힣]{2,}")
GENERIC_EVIDENCE_TERMS = {
    "digital",
    "wellbeing",
    "스마트폰",
    "사용",
    "패턴",
    "루틴",
    "habit",
    "routine",
}


def _collect_evidence_keywords(retrieved_evidence: List[Dict[str, Any]] | None) -> List[str]:
    if not retrieved_evidence:
        return []
    keywords: List[str] = []
    seen = set()
    for item in retrieved_evidence[:5]:
        if not isinstance(item, dict):
            continue
        blobs = [
            str(item.get("title") or ""),
            " ".join(str(query) for query in item.get("matched_queries") or []),
        ]
        for blob in blobs:
            for token in KEYWORD_PATTERN.findall(blob):
                lowered = token.lower()
                if lowered in GENERIC_EVIDENCE_TERMS or len(lowered) < 2 or lowered in seen:
                    continue
                seen.add(lowered)
                keywords.append(token)
                if len(keywords) >= 10:
                    return keywords
    return keywords


def _draft_mentions_evidence(report_draft: str, retrieved_evidence: List[Dict[str, Any]] | None) -> bool:
    if not retrieved_evidence:
        return True
    draft_text = str(report_draft or "").lower()
    if any(cue in draft_text for cue in ("전문 자료", "자료에서도", "자기인식", "사용 리듬")):
        return True
    return any(keyword.lower() in draft_text for keyword in _collect_evidence_keywords(retrieved_evidence))


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

    if retrieved_evidence and not _draft_mentions_evidence(report_draft, retrieved_evidence):
        issues.append("retrieved_evidence가 있는데 초안에 expert 근거 연결이 드러나지 않습니다.")
        if verdict == "PASS":
            verdict = "REWRITE"
        if not rewrite_brief:
            rewrite_brief = "retrieved_evidence 중 최소 1개와 연결되는 일반 원칙을 한 문장 이상 자연스럽게 반영하세요."

    return {"verdict": verdict, "issues": issues, "rewrite_brief": rewrite_brief}
