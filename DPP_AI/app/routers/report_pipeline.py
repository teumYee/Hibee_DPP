"""
리포트 파이프라인 API: report_writer → report_judge, 최대 3회 재시도, qa_results 로깅
"""
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.services.report_pipeline import run_report_pipeline

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/report-pipeline")
def run_report_pipeline_endpoint(body: Dict[str, Any]):
    """
    리포트 파이프라인 실행:
    1. report_writer (Claude Sonnet) → 리포트 초안
    2. report_judge (GPT-4o-mini) → PASS/REWRITE/FALLBACK
    3. REWRITE 시 rewrite_brief 반영해 재생성 (최대 2회), 3회차는 Claude Opus
    4. 최종 실패 시 fallback 템플릿 반환
    결과는 qa_results에 로깅됩니다 (DATABASE_URL 설정 시).

    Body: { snapshot, selected_patterns, kpt [, retrieved_evidence] }
    """
    try:
        result = run_report_pipeline(
            body,
            log_to_db=True,
            db_session=None,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
