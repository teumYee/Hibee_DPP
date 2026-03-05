"""
checkin_pipeline.py — checkin_writer → deterministic_check → llm_judge 를 연결하는 메인 파이프라인
qa_results 테이블에 결과 로깅
"""
import logging
from typing import Any, Callable, Dict, Optional

from .checkin_writer import generate_pattern_candidates
from .deterministic_check import run_deterministic_check
from .llm_judge import run_llm_judge

logger = logging.getLogger("dpp_ai")


def _log_to_qa_results(
    run_id: str,
    step: str,
    input_snapshot: Any,
    output_snapshot: Any,
    status: str,
    error_message: Optional[str] = None,
    db_session: Any = None,
) -> None:
    """
    qa_results 테이블에 한 스텝 결과를 로깅합니다.
    db_session이 있으면 DB에 insert, 없으면 로거로만 출력.
    """
    logger.info(
        "qa_results log: run_id=%s step=%s status=%s error=%s",
        run_id,
        step,
        status,
        error_message,
    )
    if db_session is not None:
        try:
            from app.models.qa_result import QAResult
            if QAResult is not None:
                row = QAResult(
                    run_id=run_id,
                    step=step,
                    status=status,
                    error_message=error_message,
                    input_snapshot=input_snapshot if isinstance(input_snapshot, (dict, list)) else None,
                    output_snapshot=output_snapshot if isinstance(output_snapshot, (dict, list)) else None,
                )
                db_session.add(row)
                db_session.commit()
        except Exception as e:
            logger.warning("qa_results insert failed: %s", e)
            if db_session:
                db_session.rollback()


def run_checkin_pipeline(
    input_data: Dict[str, Any],
    *,
    run_id: Optional[str] = None,
    skip_deterministic: bool = False,
    skip_llm_judge: bool = False,
    log_to_db: bool = True,
    db_session: Any = None,
) -> Dict[str, Any]:
    """
    1. checkin_writer → 패턴 후보 생성
    2. deterministic_check → 스키마/수치/금지어 검증
    3. llm_judge → PASS/RETRY/FAIL 질적 평가
    4. 각 단계 결과를 qa_results에 로깅 (옵션)

    Args:
        input_data: 패턴 생성 입력 (dashboard, user_profile 등)
        run_id: 파이프라인 실행 ID (로깅용, 없으면 자동 생성)
        skip_deterministic: True면 2단계 생략
        skip_llm_judge: True면 3단계 생략
        log_to_db: True면 qa_results에 로깅 시도
        db_session: SQLAlchemy 세션 (있으면 DB 로깅 사용)

    Returns:
        {
            "run_id": str,
            "writer_output": {...},
            "deterministic_result": {"passed": bool, "errors": [...]} | None,
            "judge_result": {"verdict": "PASS"|"RETRY"|"FAIL", "reason": ...} | None,
            "final_verdict": "PASS"|"RETRY"|"FAIL",
        }
    """
    import uuid
    run_id = run_id or str(uuid.uuid4())
    writer_output: Optional[Dict[str, Any]] = None
    deterministic_result: Optional[Dict[str, Any]] = None
    judge_result: Optional[Dict[str, Any]] = None
    final_verdict = "FAIL"

    # --- 1. Writer ---
    snapshot = input_data.get("snapshot", input_data) if isinstance(input_data, dict) else {}
    user_configs = input_data.get("user_configs", {}) if isinstance(input_data, dict) else {}
    try:
        writer_output = generate_pattern_candidates(snapshot, user_configs)
        if log_to_db:
            _log_to_qa_results(run_id, "writer", input_data, writer_output, "ok", db_session=db_session)
    except Exception as e:
        logger.exception("checkin_pipeline writer failed")
        if log_to_db:
            _log_to_qa_results(run_id, "writer", input_data, None, "error", str(e), db_session=db_session)
        return {
            "run_id": run_id,
            "writer_output": None,
            "deterministic_result": None,
            "judge_result": None,
            "final_verdict": "FAIL",
            "error": str(e),
        }

    # --- 2. Deterministic check ---
    if not skip_deterministic and writer_output:
        deterministic_result = run_deterministic_check(writer_output)
        if log_to_db:
            _log_to_qa_results(
                run_id, "deterministic_check", writer_output, deterministic_result,
                "ok" if deterministic_result["passed"] else "fail",
                db_session=db_session,
            )
        if not deterministic_result["passed"]:
            final_verdict = "FAIL"
            return {
                "run_id": run_id,
                "writer_output": writer_output,
                "deterministic_result": deterministic_result,
                "judge_result": None,
                "final_verdict": final_verdict,
            }

    # --- 3. LLM Judge ---
    if not skip_llm_judge and writer_output:
        judge_result = run_llm_judge(writer_output)
        if log_to_db:
            _log_to_qa_results(run_id, "llm_judge", writer_output, judge_result, "ok", db_session=db_session)
        final_verdict = judge_result.get("verdict", "FAIL")

    return {
        "run_id": run_id,
        "writer_output": writer_output,
        "deterministic_result": deterministic_result,
        "judge_result": judge_result,
        "final_verdict": final_verdict,
    }
