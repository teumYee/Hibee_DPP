import os
import json
from typing import Any, Dict

from openai import OpenAI

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def call_llm(
    system_prompt: str,
    user_content: Dict[str, Any],
    model: str = "gpt-4o-mini",
    temperature: float = 0.4
) -> Dict[str, Any]:
    """
    공통 LLM 호출 함수
    - 질문 생성 / 리포트 생성 공용
    - JSON 응답만 반환하도록 설계
    """

    response = _client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(user_content, ensure_ascii=False)
            }
        ],
    )

    text = response.choices[0].message.content.strip()

    # JSON만 안전하게 파싱
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise RuntimeError(f"LLM returned non-JSON output:\n{text}")
