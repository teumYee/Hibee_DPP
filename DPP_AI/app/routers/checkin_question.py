import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from openai import OpenAI  # pip3 install openai

router = APIRouter(prefix="/ai", tags=["ai"])

# ----------------------------
# Input schema (ai-test의 checkin JSON 형태를 그대로)
# ----------------------------
class PreviousAnswer(BaseModel):
    step: int
    selected_values: List[str]
    free_text: Optional[str] = ""

class PromptRef(BaseModel):
    # ai-test 폴더 기준 상대경로
    policy_path: str
    template_path: str

class CheckInQuestionRequest(BaseModel):
    user: Dict[str, Any]
    step: int = Field(ge=1, le=3)
    context: Dict[str, Any]
    previous_answers: List[PreviousAnswer] = []
    question_policy: Dict[str, Any]
    prompt_ref: PromptRef

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

def _build_messages(policy_text: str, template_text: str, req: CheckInQuestionRequest) -> List[Dict[str, Any]]:
    """
    OpenAI Responses API에 넣을 메시지 구성.
    - policy_text: 고정 정책/금지사항
    - template_text: 질문 생성 프롬프트 본문(템플릿)
    - req: checkin 입력(JSON)
    """
    # 템플릿에서 {{...}} 치환을 하고 싶으면 여기서 처리해도 됨.
    # 지금은 "정책 + 템플릿 + 입력 JSON"을 그대로 제공.
    developer = policy_text.strip() + "\n\n" + template_text.strip()

    user_payload = {
        "user": req.user,
        "step": req.step,
        "context": req.context,
        "previous_answers": [a.model_dump() for a in req.previous_answers],
        "question_policy": req.question_policy,
    }

    return [
        {"role": "developer", "content": developer},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]

@router.post("/checkin-question")
def generate_checkin_question(req: CheckInQuestionRequest):
    try:
        ai_test_root = os.getenv("AI_TEST_ROOT")
        if not ai_test_root:
            raise HTTPException(status_code=500, detail="AI_TEST_ROOT env missing")

        policy_text = _safe_read_text(ai_test_root, req.prompt_ref.policy_path)
        template_text = _safe_read_text(ai_test_root, req.prompt_ref.template_path)

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_MODEL", "gpt-5")

        resp = client.responses.create(
            model=model,
            input=_build_messages(policy_text, template_text, req),
        )

        raw = (resp.output_text or "").strip()
        if not raw:
            raise HTTPException(status_code=500, detail="Empty model output")

        # 모델 출력은 "JSON ONLY"가 이상적. 그래도 파싱으로 보장.
        try:
            data = json.loads(raw)
        except Exception:
            raise HTTPException(status_code=500, detail=f"Model did not return valid JSON: {raw[:200]}")

        return data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"checkin-question failed: {e}")
