import os
from typing import Any, Dict

import requests


DEFAULT_AI_SERVICE_BASE_URL = "http://127.0.0.1:8001"
DEFAULT_AI_SERVICE_TIMEOUT_SEC = 60


def _get_ai_service_base_url() -> str:
    return os.getenv("DPP_AI_BASE_URL", DEFAULT_AI_SERVICE_BASE_URL).rstrip("/")


def _get_ai_service_timeout_sec() -> float:
    raw_timeout = os.getenv("DPP_AI_TIMEOUT_SEC", str(DEFAULT_AI_SERVICE_TIMEOUT_SEC))
    try:
        return float(raw_timeout)
    except (TypeError, ValueError):
        return float(DEFAULT_AI_SERVICE_TIMEOUT_SEC)


def _post_to_ai_service(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{_get_ai_service_base_url()}{path}"
    timeout_sec = _get_ai_service_timeout_sec()

    try:
        response = requests.post(url, json=payload, timeout=timeout_sec)
    except requests.RequestException as exc:
        raise RuntimeError(f"AI 서버 요청 실패 ({url}): {exc}") from exc

    if not response.ok:
        detail = response.text.strip()
        raise RuntimeError(
            f"AI 서버 응답 오류 ({response.status_code})"
            + (f": {detail}" if detail else "")
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise RuntimeError(f"AI 서버가 JSON이 아닌 응답을 반환했습니다: {response.text[:200]}") from exc

    if not isinstance(data, dict):
        raise RuntimeError("AI 서버 응답 형식이 올바르지 않습니다.")

    return data


def run_checkin_pipeline_via_ai_service(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _post_to_ai_service("/ai/checkin-pipeline", payload)


def run_report_pipeline_via_ai_service(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _post_to_ai_service("/ai/report-pipeline", payload)
