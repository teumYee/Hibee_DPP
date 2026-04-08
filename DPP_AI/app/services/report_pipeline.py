"""
report_pipeline.py — report_writer → report_judge 연결, 최대 3회 재시도, qa_results 로깅
"""
import logging
import uuid
from typing import Any, Dict, List, Optional

from .evidence_retrieval import retrieve_report_evidence
from .report_writer import generate_report
from .report_judge import run_report_judge

logger = logging.getLogger("dpp_ai")

MAX_ATTEMPTS = 3
_QA_RESULTS_DISABLED = False
FALLBACK_TEMPLATE = """# 오늘의 요약

데일리 리포트를 생성하지 못했습니다.
오늘 선택하신 패턴과 기록을 바탕으로, 앱 내 요약 화면을 확인해 주세요.
"""


def _log_to_qa_results(
    run_id: str,
    step: str,
    input_snapshot: Any,
    output_snapshot: Any,
    status: str,
    error_message: Optional[str] = None,
    db_session: Any = None,
) -> None:
    """qa_results 테이블에 한 스텝 결과 로깅 (checkin_pipeline과 동일 방식)."""
    logger.info(
        "qa_results log: run_id=%s step=%s status=%s error=%s",
        run_id,
        step,
        status,
        error_message,
    )
    global _QA_RESULTS_DISABLED
    if db_session is not None and not _QA_RESULTS_DISABLED:
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
            error_text = str(e)
            if 'relation "qa_results" does not exist' in error_text:
                _QA_RESULTS_DISABLED = True
                logger.warning("qa_results table missing; disable DB qa logging")
            else:
                logger.warning("qa_results insert failed: %s", e)
            if db_session:
                db_session.rollback()


def run_report_pipeline(
    input_data: Dict[str, Any],
    *,
    run_id: Optional[str] = None,
    log_to_db: bool = True,
    db_session: Any = None,
) -> Dict[str, Any]:
    """
    1. report_writer (Claude Sonnet) → 리포트 초안
    2. report_judge (GPT-4o-mini) → PASS / REWRITE / FALLBACK
    3. REWRITE면 rewrite_brief 반영해 최대 2회까지 재생성
    4. 3회차는 Claude Opus로 전환
    5. 최종 실패 시 fallback 템플릿 반환
    6. 각 단계 qa_results 로깅

    Args:
        input_data: { snapshot, selected_patterns, kpt [, retrieved_evidence] }
        run_id: 로깅용 (없으면 자동 생성)
        log_to_db: qa_results 로깅 여부
        db_session: DB 세션 (있으면 insert)

    Returns:
        {
            "run_id": str,
            "report_markdown": str,
            "final_verdict": "PASS" | "REWRITE" | "FALLBACK",
            "attempts": int,
            "judge_results": [...],
            "used_fallback_template": bool,
        }
    """
    run_id = run_id or str(uuid.uuid4())
    snapshot = input_data.get("snapshot", {}) if isinstance(input_data, dict) else {}
    user_configs = input_data.get("user_configs", {}) if isinstance(input_data, dict) else {}
    selected_patterns = input_data.get("selected_patterns", [])
    if not isinstance(selected_patterns, list):
        selected_patterns = []
    kpt = input_data.get("kpt", {}) if isinstance(input_data, dict) else {}
    retrieved_evidence = input_data.get("retrieved_evidence")
    queries = input_data.get("queries")
    filters = input_data.get("filters")
    must_include_concepts = input_data.get("must_include_concepts")
    retrieval_debug = input_data.get("retrieval_debug")
    should_retrieve = (
        not isinstance(retrieved_evidence, list)
        or len(retrieved_evidence) == 0
        or not isinstance(queries, list)
        or len(queries) == 0
    )
    if should_retrieve:
        retrieval_result = retrieve_report_evidence(
            snapshot,
            selected_patterns,
            kpt,
            user_configs,
            db_session=db_session,
        )
        retrieved_evidence = retrieval_result.get("retrieved_evidence", [])
        queries = retrieval_result.get("queries", [])
        filters = retrieval_result.get("filters", {})
        must_include_concepts = retrieval_result.get("must_include_concepts", [])
        retrieval_debug = retrieval_result.get("retrieval_debug", {})
    else:
        queries = queries if isinstance(queries, list) else []
        filters = filters if isinstance(filters, dict) else {}
        must_include_concepts = (
            must_include_concepts if isinstance(must_include_concepts, list) else []
        )
        retrieval_debug = retrieval_debug if isinstance(retrieval_debug, dict) else {
            "retrieval_ran": False,
            "retrieval_skipped_reason": "caller_provided_retrieval",
            "query_count": len(queries),
            "evidence_count": len(retrieved_evidence),
            "query_stats": [],
        }

    judge_results: List[Dict[str, Any]] = []
    report_markdown = ""
    final_verdict = "FALLBACK"
    used_fallback_template = False
    attempt = 0

    for attempt in range(1, MAX_ATTEMPTS + 1):
        use_opus = attempt == MAX_ATTEMPTS
        rewrite_brief: Optional[str] = None
        if attempt > 1 and len(judge_results) > 0:
            rewrite_brief = judge_results[-1].get("rewrite_brief") or ""

        # --- Writer ---
        try:
            writer_out = generate_report(
                snapshot,
                user_configs,
                selected_patterns,
                kpt,
                retrieved_evidence=retrieved_evidence,
                rewrite_brief=rewrite_brief,
                use_opus=use_opus,
            )
            report_markdown = writer_out.get("report_markdown") or ""
            if log_to_db:
                _log_to_qa_results(
                    run_id,
                    f"report_writer_attempt_{attempt}",
                    input_data,
                    {"report_markdown_len": len(report_markdown)},
                    "ok",
                    db_session=db_session,
                )
        except Exception as e:
            logger.exception("report_pipeline writer attempt %s failed", attempt)
            if log_to_db:
                _log_to_qa_results(
                    run_id,
                    f"report_writer_attempt_{attempt}",
                    input_data,
                    None,
                    "error",
                    str(e),
                    db_session=db_session,
                )
            if attempt == MAX_ATTEMPTS:
                report_markdown = FALLBACK_TEMPLATE
                used_fallback_template = True
            continue

        if not report_markdown.strip():
            if attempt == MAX_ATTEMPTS:
                report_markdown = FALLBACK_TEMPLATE
                used_fallback_template = True
            continue

        # --- Judge ---
        judge_result = run_report_judge(
            report_markdown,
            snapshot,
            kpt,
            retrieved_evidence=retrieved_evidence,
        )
        judge_results.append(judge_result)
        if log_to_db:
            _log_to_qa_results(
                run_id,
                f"report_judge_attempt_{attempt}",
                {"report_draft_len": len(report_markdown)},
                judge_result,
                "ok",
                db_session=db_session,
            )

        final_verdict = judge_result.get("verdict", "FALLBACK")
        if final_verdict == "PASS":
            break
        if final_verdict == "FALLBACK" and attempt < MAX_ATTEMPTS:
            # 다음 시도에서 Opus로 갈 수 있도록 계속
            pass
        elif final_verdict == "FALLBACK" and attempt == MAX_ATTEMPTS:
            report_markdown = FALLBACK_TEMPLATE
            used_fallback_template = True
            break

    if not report_markdown.strip():
        report_markdown = FALLBACK_TEMPLATE
        used_fallback_template = True

    return {
        "run_id": run_id,
        "report_markdown": report_markdown,
        "final_verdict": final_verdict,
        "attempts": attempt,
        "judge_results": judge_results,
        "used_fallback_template": used_fallback_template,
        "queries": queries,
        "filters": filters,
        "must_include_concepts": must_include_concepts,
        "retrieved_evidence": retrieved_evidence,
        "retrieval_debug": retrieval_debug,
    }
