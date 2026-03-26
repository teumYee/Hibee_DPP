import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from openai import OpenAI  # pip3 install openai

router = APIRouter(prefix="/ai", tags=["ai"])

# OpenAI client singleton (module-level)
_client: Optional[OpenAI] = None
_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client

_PROMPT_MAP: Dict[int, tuple[str, str]] = {
    1: ("prompts/policy.txt", "prompts/step1.txt"),
    2: ("prompts/policy.txt", "prompts/step2.txt"),
    3: ("prompts/policy.txt", "prompts/step3.txt"),
}

# ----------------------------
# Input schema (ai-test의 checkin JSON 형태를 그대로)
# ----------------------------
class PreviousAnswer(BaseModel):
    step: int
    selected_values: List[str]
    free_text: Optional[str] = ""

class CheckInQuestionRequest(BaseModel):
    user: Dict[str, Any]
    step: int = Field(ge=1, le=3)
    context: Dict[str, Any]
    previous_answers: List[PreviousAnswer] = []
    question_policy: Dict[str, Any]

# ----------------------------
# Helpers
# ----------------------------
def _safe_read_text(ai_test_root: str, rel_path: str) -> str:
    """
    ai-test root 아래 파일만 읽도록 안전장치 포함.
    """
    root = Path(ai_test_root).resolve()
    target = (root / rel_path).resolve()

    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid prompt path (path traversal blocked).")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=400, detail=f"Prompt file not found: {rel_path}")

    return target.read_text(encoding="utf-8")

def _is_new_user(context: Dict[str, Any]) -> bool:
    """
    context.profile_metrics가 없거나 모든 값이 0이면 신규 유저로 판단.
    """
    profile = context.get("profile_metrics")
    if not profile or not isinstance(profile, dict):
        return True
    return all(v == 0 for v in profile.values() if isinstance(v, (int, float)))


def _build_messages(policy_text: str, template_text: str, req: CheckInQuestionRequest) -> List[Dict[str, Any]]:
    """
    OpenAI Chat Completions API에 넣을 메시지 구성.
    - policy_text: 고정 정책/금지사항
    - template_text: 질문 생성 프롬프트 본문(템플릿)
    - req: checkin 입력(JSON)
    """
    developer = policy_text.strip() + "\n\n" + template_text.strip()

    user_payload = {
        "user": req.user,
        "step": req.step,
        "context": req.context,
        "is_new_user": _is_new_user(req.context),
        "previous_answers": [a.model_dump() for a in req.previous_answers],
        "question_policy": req.question_policy,
    }

    return [
        {"role": "system", "content": developer},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]

@router.post("/checkin-question")
def generate_checkin_question(req: CheckInQuestionRequest):
    try:
        ai_test_root = os.getenv("AI_TEST_ROOT")
        if not ai_test_root:
            raise HTTPException(status_code=500, detail="AI_TEST_ROOT env missing")

        policy_path, template_path = _PROMPT_MAP[req.step]
        policy_text = _safe_read_text(ai_test_root, policy_path)
        template_text = _safe_read_text(ai_test_root, template_path)

        resp = _get_client().chat.completions.create(
            model=_model,
            messages=_build_messages(policy_text, template_text, req),
        )

        raw = (resp.choices[0].message.content or "").strip()
        if not raw:
            raise HTTPException(status_code=500, detail="Empty model output")

        # 모델 출력은 "JSON ONLY"가 이상적. 그래도 파싱으로 보장.
        try:
            data = json.loads(raw)
        except Exception:
            raise HTTPException(status_code=500, detail=f"Model did not return valid JSON: {raw[:200]}")

        # options 개수 검증: 반드시 5개
        options = data.get("options")
        if not isinstance(options, list) or len(options) != 5:
            count = len(options) if isinstance(options, list) else 0
            raise HTTPException(
                status_code=400,
                detail=f"Model returned {count} options (expected exactly 5). Raw: {raw[:300]}",
            )

        return data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"checkin-question failed: {e}")
