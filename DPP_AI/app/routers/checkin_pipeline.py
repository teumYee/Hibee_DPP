"""
체크인 QA 파이프라인 API: writer → deterministic_check → llm_judge, qa_results 로깅
"""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db
from app.services.checkin_pipeline import run_checkin_pipeline

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/checkin-pipeline")
def run_pipeline(body: Dict[str, Any], db_session: Any = Depends(get_db)):
    """
    체크인 QA 파이프라인 실행:
    1. checkin_writer (GPT-4o-mini 패턴 후보 생성)
    2. deterministic_check (스키마/수치/금지어 검증)
    3. llm_judge (PASS/RETRY/FAIL)
    결과는 qa_results에 로깅됩니다 (DATABASE_URL 설정 시).
    """
    try:
        result = run_checkin_pipeline(
            body,
            log_to_db=True,
            db_session=db_session,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
