from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.calendar import CheckIn, PatternCandidatesDaily, PatternCandidatesLog
from app.models.reports import DailyReports, ReportDraft, ReportEvidenceTrace, ReportReviewLog, WeeklyReports
from app.models.usage_log import Daily_SnapShots
from app.models.user import User_Configs, Users
from app.schemas.report import (
    CheckinResponse,
    CheckinSaveRequest,
    DailyReviewResponse,
    DailyReportGenerateRequest,
    DailyReportResponse,
    PatternCandidatesGenerateRequest,
    PatternCandidatesResponse,
    WeeklyReportGenerateRequest,
    WeeklyReportResponse,
)
from services.ai_client import run_checkin_pipeline_via_ai_service
from services.report_pipeline_service import (
    build_daily_report_response_payload,
    build_weekly_report_response_payload,
    build_weekly_report,
    normalize_week_start,
    render_weekly_report_from_record,
    run_daily_report_pipeline,
)

router = APIRouter()


def _build_checkin_pipeline_input(snapshot: Daily_SnapShots, user_config: User_Configs | None) -> Dict[str, Any]:
    return {
        "snapshot": {
            "date": snapshot.snapshot_date.isoformat() if snapshot.snapshot_date else "",
            "total_usage_sec": snapshot.total_usage_check or 0,
            "total_usage_check": snapshot.total_usage_check or 0,
            "unlock_count": snapshot.unlock_count or 0,
            "time_of_day_buckets_sec": snapshot.time_of_day_buckets_json or {},
            "max_continuous_sec": snapshot.max_continuous_sec or 0,
            "app_launch_count": snapshot.app_launch_count or 0,
            "package_name": snapshot.package_name,
        },
        "user_configs": {
            "goals": user_config.goals if user_config else [],
            "active_times": user_config.active_times if user_config else [],
            "struggles": user_config.struggles if user_config else [],
            "night_mode_start": user_config.night_mode_start if user_config else "23:00",
            "night_mode_end": user_config.night_mode_end if user_config else "07:00",
            "checkin_time": user_config.checkin_time if user_config else "21:00",
        },
    }


def _normalize_pipeline_candidates(raw_candidates: Any) -> List[dict]:
    if not isinstance(raw_candidates, list):
        return []

    normalized: List[dict] = []
    for item in raw_candidates:
        if not isinstance(item, dict):
            continue

        candidate = dict(item)
        label = str(candidate.get("label") or "").strip()
        observation = str(candidate.get("observation") or "").strip()
        interpretation = str(candidate.get("interpretation") or "").strip()

        if label and not candidate.get("title"):
            candidate["title"] = label
        if not candidate.get("description"):
            candidate["description"] = interpretation or observation

        evidence = candidate.get("evidence")
        if not isinstance(evidence, dict):
            candidate["evidence"] = {"metrics_used": [], "numbers": []}
        else:
            evidence = dict(evidence)
            if not isinstance(evidence.get("metrics_used"), list):
                evidence["metrics_used"] = []
            if not isinstance(evidence.get("numbers"), list):
                evidence["numbers"] = []
            candidate["evidence"] = evidence

        if not isinstance(candidate.get("tags"), list):
            candidate["tags"] = []

        normalized.append(candidate)

    return normalized


def _weekly_evidence_refs_from_rows(
    snapshots: List[Daily_SnapShots],
    checkins: List[CheckIn],
    daily_reports: List[DailyReports],
) -> List[str]:
    refs = set()

    for snapshot in snapshots:
        if snapshot.snapshot_date:
            refs.add(f"snapshot:{snapshot.snapshot_date.isoformat()}")

    for checkin in checkins:
        refs.add(f"checkin:{checkin.date.isoformat()}")

    for daily_report in daily_reports:
        refs.add(f"daily_report:{daily_report.date.date().isoformat()}")

    return sorted(refs)


def _get_latest_daily_review_bundle(
    db: Session,
    user_id: int,
    target_date: date,
):
    report_dt = datetime.combine(target_date, datetime.min.time())
    draft = (
        db.query(ReportDraft)
        .filter(
            ReportDraft.user_id == user_id,
            ReportDraft.date == report_dt,
        )
        .order_by(ReportDraft.id.desc())
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="해당 날짜의 데일리 리포트 검수 로그가 없습니다.")

    evidence_trace = (
        db.query(ReportEvidenceTrace)
        .filter(ReportEvidenceTrace.report_draft_id == draft.id)
        .order_by(ReportEvidenceTrace.id.desc())
        .first()
    )
    review_log = (
        db.query(ReportReviewLog)
        .filter(ReportReviewLog.report_draft_id == draft.id)
        .order_by(ReportReviewLog.id.desc())
        .first()
    )

    return draft, evidence_trace, review_log


@router.post("/pattern-candidates/generate", response_model=PatternCandidatesResponse)
async def generate_pattern_candidates(
    payload: PatternCandidatesGenerateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id

    snapshot = db.query(Daily_SnapShots).filter(
        Daily_SnapShots.user_id == current_user_id,
        Daily_SnapShots.snapshot_date == payload.date,
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="스냅샷이 먼저 업로드되어야 합니다.")

    existing = db.query(PatternCandidatesDaily).filter(
        PatternCandidatesDaily.user_id == current_user_id,
        PatternCandidatesDaily.date == payload.date,
    ).first()

    if existing and not payload.force_regenerate:
        return PatternCandidatesResponse(
            date=str(payload.date),
            status="already_exists",
            generated=False,
            candidates=existing.candidates or [],
        )

    user_config = db.query(User_Configs).filter(User_Configs.user_id == current_user_id).first()
    pipeline_input = _build_checkin_pipeline_input(snapshot, user_config)

    try:
        pipeline_result = run_checkin_pipeline_via_ai_service(pipeline_input)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"패턴 후보 생성 파이프라인 호출 실패: {exc}")

    writer_output = pipeline_result.get("writer_output") or {}
    candidates = _normalize_pipeline_candidates(writer_output.get("pattern_candidates"))
    final_verdict = str(pipeline_result.get("final_verdict") or "FAIL").upper()
    judge_result = pipeline_result.get("judge_result") or {}
    deterministic_result = pipeline_result.get("deterministic_result") or {}

    if final_verdict != "PASS":
        failure_reasons = []
        if isinstance(deterministic_result.get("errors"), list):
            failure_reasons.extend(str(item) for item in deterministic_result["errors"])
        if isinstance(judge_result.get("reasons"), list):
            failure_reasons.extend(str(item) for item in judge_result["reasons"])
        if pipeline_result.get("error"):
            failure_reasons.append(str(pipeline_result["error"]))

        detail = "패턴 후보 생성 파이프라인 검수를 통과하지 못했습니다."
        if failure_reasons:
            detail = f"{detail} {' | '.join(failure_reasons[:3])}"
        raise HTTPException(status_code=502, detail=detail)

    if existing:
        existing.candidates = candidates
        record = existing
    else:
        record = PatternCandidatesDaily(
            user_id=current_user_id,
            date=payload.date,
            candidates=candidates,
        )
        db.add(record)

    db.flush()
    db.add(
        PatternCandidatesLog(
            pattern_candidate_daily_id=record.id,
            verdict=final_verdict,
            violations=judge_result.get("violations") if isinstance(judge_result, dict) else None,
        )
    )
    db.commit()
    db.refresh(record)
    return PatternCandidatesResponse(
        date=str(payload.date),
        status="generated",
        generated=True,
        candidates=record.candidates or [],
    )


@router.get("/pattern-candidates", response_model=PatternCandidatesResponse)
def get_pattern_candidates(
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id

    record = db.query(PatternCandidatesDaily).filter(
        PatternCandidatesDaily.user_id == current_user_id,
        PatternCandidatesDaily.date == target_date,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="해당 날짜의 패턴 후보가 없습니다.")

    return PatternCandidatesResponse(
        date=str(target_date),
        status="done",
        generated=False,
        candidates=record.candidates or [],
    )


@router.post("/checkins", response_model=CheckinResponse)
def save_checkin(
    payload: CheckinSaveRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id

    existing = db.query(CheckIn).filter(
        CheckIn.user_id == current_user_id,
        CheckIn.date == payload.date,
    ).first()

    selected_patterns = [item.model_dump() for item in payload.selected_patterns]

    if existing:
        was_completed = bool(existing.is_completed)
        existing.selected_patterns = selected_patterns
        existing.kpt_keep = payload.kpt_keep
        existing.kpt_problem = payload.kpt_problem
        existing.kpt_try = payload.kpt_try
        existing.is_completed = payload.is_completed
        if payload.is_completed:
            if not was_completed:
                existing.completed_at = datetime.now(timezone.utc)
        else:
            existing.completed_at = None
        record = existing
    else:
        record = CheckIn(
            user_id=current_user_id,
            date=payload.date,
            selected_patterns=selected_patterns,
            kpt_keep=payload.kpt_keep,
            kpt_problem=payload.kpt_problem,
            kpt_try=payload.kpt_try,
            is_completed=payload.is_completed,
            completed_at=datetime.now(timezone.utc) if payload.is_completed else None,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    return CheckinResponse(
        checkin_id=record.id,
        date=str(record.date),
        selected_patterns=record.selected_patterns or [],
        kpt_keep=record.kpt_keep,
        kpt_problem=record.kpt_problem,
        kpt_try=record.kpt_try,
        is_completed=record.is_completed,
    )


@router.get("/checkins", response_model=CheckinResponse)
def get_checkin(
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id

    record = db.query(CheckIn).filter(
        CheckIn.user_id == current_user_id,
        CheckIn.date == target_date,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="해당 날짜의 체크인이 없습니다.")

    return CheckinResponse(
        checkin_id=record.id,
        date=str(record.date),
        selected_patterns=record.selected_patterns or [],
        kpt_keep=record.kpt_keep,
        kpt_problem=record.kpt_problem,
        kpt_try=record.kpt_try,
        is_completed=record.is_completed,
    )


@router.post("/daily/generate", response_model=DailyReportResponse)
def generate_daily_report(
    payload: DailyReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id

    snapshot = db.query(Daily_SnapShots).filter(
        Daily_SnapShots.user_id == current_user_id,
        Daily_SnapShots.snapshot_date == payload.date,
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="스냅샷이 먼저 업로드되어야 합니다.")

    checkin = db.query(CheckIn).filter(
        CheckIn.user_id == current_user_id,
        CheckIn.date == payload.date,
    ).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="체크인이 먼저 저장되어야 합니다.")

    user_config = db.query(User_Configs).filter(User_Configs.user_id == current_user_id).first()

    existing_daily = db.query(DailyReports).filter(
        DailyReports.user_id == current_user_id,
        DailyReports.date == datetime.combine(payload.date, datetime.min.time()),
    ).first()
    if existing_daily and not payload.force_regenerate:
        response_payload = build_daily_report_response_payload(
            target_date=payload.date,
            snapshot=snapshot,
            checkin=checkin,
            report_markdown=existing_daily.content,
        )
        return DailyReportResponse(
            date=str(payload.date),
            status="already_exists",
            **response_payload,
            evidence_refs=[],
            issues=[],
        )

    # RAG(검색) -> 작성 -> 검수 파이프라인 (실제 LLM 호출 + fallback)
    rag_result, report_markdown, review_result = run_daily_report_pipeline(
        snapshot,
        checkin,
        user_config,
        db,
    )
    final_status = "DONE" if review_result.get("verdict") == "PASS" else "FALLBACK_DONE"

    report_dt = datetime.combine(payload.date, datetime.min.time())

    # 중간 결과 저장
    draft = ReportDraft(
        user_id=current_user_id,
        date=report_dt,
        content=report_markdown,
        total_time=snapshot.total_usage_check or 0,
        late_night_usage=0,
        category_usage=snapshot.time_of_day_buckets_json,
    )
    db.add(draft)
    db.flush()

    trace = ReportEvidenceTrace(
        report_draft_id=draft.id,
        search_queries=rag_result["queries"],
        search_filters=rag_result["filters"],
        must_include_concepts=rag_result["must_include_concepts"],
        retrieved_evidence=rag_result["retrieved_evidence"],
    )
    db.add(trace)

    review_log = ReportReviewLog(
        user_id=current_user_id,
        report_draft_id=draft.id,
        verdict=(review_result["verdict"] == "PASS"),
        issues=review_result.get("issues", []),
        rewrite_brief=review_result.get("rewrite_brief", {"note": "auto review"}),
        iteration_count=1,
    )
    db.add(review_log)

    # 최종 리포트는 검수 PASS일 때만 저장/갱신
    if review_result.get("verdict") == "PASS":
        if existing_daily:
            existing_daily.content = report_markdown
            existing_daily.total_time = snapshot.total_usage_check or 0
            existing_daily.category_usage = snapshot.time_of_day_buckets_json
        else:
            daily_report = DailyReports(
                user_id=current_user_id,
                date=report_dt,
                content=report_markdown,
                total_time=snapshot.total_usage_check or 0,
                late_night_usage=0,
                category_usage=snapshot.time_of_day_buckets_json,
            )
            db.add(daily_report)

    db.commit()

    evidence_refs = [item["doc_id"] for item in rag_result["retrieved_evidence"] if "doc_id" in item]
    response_payload = build_daily_report_response_payload(
        target_date=payload.date,
        snapshot=snapshot,
        checkin=checkin,
        report_markdown=report_markdown,
    )
    return DailyReportResponse(
        date=str(payload.date),
        status=final_status,
        **response_payload,
        evidence_refs=evidence_refs,
        issues=review_result.get("issues", []),
    )


@router.get("/daily", response_model=DailyReportResponse)
def get_daily_report(
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id
    report_dt = datetime.combine(target_date, datetime.min.time())

    daily_report = db.query(DailyReports).filter(
        DailyReports.user_id == current_user_id,
        DailyReports.date == report_dt,
    ).first()
    if not daily_report:
        raise HTTPException(status_code=404, detail="해당 날짜의 데일리 리포트가 없습니다.")

    snapshot = db.query(Daily_SnapShots).filter(
        Daily_SnapShots.user_id == current_user_id,
        Daily_SnapShots.snapshot_date == target_date,
    ).first()
    checkin = db.query(CheckIn).filter(
        CheckIn.user_id == current_user_id,
        CheckIn.date == target_date,
    ).first()

    if not snapshot or not checkin:
        raise HTTPException(status_code=404, detail="리포트 구조화 응답에 필요한 스냅샷 또는 체크인이 없습니다.")

    response_payload = build_daily_report_response_payload(
        target_date=target_date,
        snapshot=snapshot,
        checkin=checkin,
        report_markdown=daily_report.content,
    )
    return DailyReportResponse(
        date=str(target_date),
        status="DONE",
        **response_payload,
        evidence_refs=[],
        issues=[],
    )


@router.get("/daily/review", response_model=DailyReviewResponse)
def get_daily_review(
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id
    draft, evidence_trace, review_log = _get_latest_daily_review_bundle(db, current_user_id, target_date)

    return DailyReviewResponse(
        date=str(target_date),
        draft_id=draft.id,
        status="PASS" if review_log and review_log.verdict else "FAIL",
        iteration_count=review_log.iteration_count if review_log else 0,
        report_markdown=draft.content,
        issues=review_log.issues if review_log and review_log.issues else [],
        rewrite_brief=review_log.rewrite_brief if review_log else None,
        search_queries=evidence_trace.search_queries if evidence_trace and evidence_trace.search_queries else [],
        search_filters=evidence_trace.search_filters if evidence_trace and evidence_trace.search_filters else {},
        must_include_concepts=(
            evidence_trace.must_include_concepts
            if evidence_trace and evidence_trace.must_include_concepts
            else []
        ),
        retrieved_evidence=(
            evidence_trace.retrieved_evidence
            if evidence_trace and evidence_trace.retrieved_evidence
            else []
        ),
    )


@router.post("/weekly/generate", response_model=WeeklyReportResponse)
def generate_weekly_report(
    payload: WeeklyReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id
    week_start = normalize_week_start(payload.week_start)
    week_end = week_start + timedelta(days=6)
    next_week_start = week_end + timedelta(days=1)

    existing_weekly = db.query(WeeklyReports).filter(
        WeeklyReports.user_id == current_user_id,
        WeeklyReports.date_week == week_start.isoformat(),
    ).first()

    snapshot_rows = db.query(Daily_SnapShots).filter(
        Daily_SnapShots.user_id == current_user_id,
        Daily_SnapShots.snapshot_date >= week_start,
        Daily_SnapShots.snapshot_date <= week_end,
    ).all()
    checkin_rows = db.query(CheckIn).filter(
        CheckIn.user_id == current_user_id,
        CheckIn.date >= week_start,
        CheckIn.date <= week_end,
    ).all()
    daily_report_rows = db.query(DailyReports).filter(
        DailyReports.user_id == current_user_id,
        DailyReports.date >= datetime.combine(week_start, datetime.min.time()),
        DailyReports.date < datetime.combine(next_week_start, datetime.min.time()),
    ).all()

    if existing_weekly and not payload.force_regenerate:
        report_markdown = render_weekly_report_from_record(existing_weekly)
        response_payload = build_weekly_report_response_payload(
            week_start=week_start,
            report_source={
                "ai_score": existing_weekly.ai_score,
                "checkin_count": existing_weekly.checkin_count,
                "analysis": existing_weekly.analysis,
                "main_activity_time": existing_weekly.main_activity_time,
                "better_day": existing_weekly.better_day,
                "try_area": existing_weekly.try_area,
                "ai_comment": existing_weekly.ai_comment,
            },
            snapshots=snapshot_rows,
            checkins=checkin_rows,
            daily_reports=daily_report_rows,
            report_markdown=report_markdown,
        )
        return WeeklyReportResponse(
            week_start=week_start.isoformat(),
            status="already_exists",
            **response_payload,
            issues=[],
        )

    try:
        weekly_result = build_weekly_report(
            week_start=week_start,
            snapshots=snapshot_rows,
            checkins=checkin_rows,
            daily_reports=daily_report_rows,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if existing_weekly:
        existing_weekly.ai_score = weekly_result["ai_score"]
        existing_weekly.checkin_count = weekly_result["checkin_count"]
        existing_weekly.analysis = weekly_result["analysis"]
        existing_weekly.main_activity_time = weekly_result["main_activity_time"]
        existing_weekly.better_day = weekly_result["better_day"]
        existing_weekly.try_area = weekly_result["try_area"]
        existing_weekly.ai_comment = weekly_result["ai_comment"]
    else:
        existing_weekly = WeeklyReports(
            user_id=current_user_id,
            date_week=week_start.isoformat(),
            ai_score=weekly_result["ai_score"],
            checkin_count=weekly_result["checkin_count"],
            analysis=weekly_result["analysis"],
            main_activity_time=weekly_result["main_activity_time"],
            better_day=weekly_result["better_day"],
            try_area=weekly_result["try_area"],
            ai_comment=weekly_result["ai_comment"],
        )
        db.add(existing_weekly)

    db.commit()

    response_payload = build_weekly_report_response_payload(
        week_start=week_start,
        report_source=weekly_result,
        snapshots=snapshot_rows,
        checkins=checkin_rows,
        daily_reports=daily_report_rows,
        report_markdown=weekly_result["report_markdown"],
    )
    return WeeklyReportResponse(
        week_start=week_start.isoformat(),
        status="DONE",
        **response_payload,
        issues=[],
    )


@router.get("/weekly", response_model=WeeklyReportResponse)
def get_weekly_report(
    week_start: date = Query(...),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id
    normalized_week_start = normalize_week_start(week_start)
    week_end = normalized_week_start + timedelta(days=6)
    next_week_start = week_end + timedelta(days=1)

    weekly_report = db.query(WeeklyReports).filter(
        WeeklyReports.user_id == current_user_id,
        WeeklyReports.date_week == normalized_week_start.isoformat(),
    ).first()
    if not weekly_report:
        raise HTTPException(status_code=404, detail="해당 주간 리포트가 없습니다.")

    snapshot_rows = db.query(Daily_SnapShots).filter(
        Daily_SnapShots.user_id == current_user_id,
        Daily_SnapShots.snapshot_date >= normalized_week_start,
        Daily_SnapShots.snapshot_date <= week_end,
    ).all()
    checkin_rows = db.query(CheckIn).filter(
        CheckIn.user_id == current_user_id,
        CheckIn.date >= normalized_week_start,
        CheckIn.date <= week_end,
    ).all()
    daily_report_rows = db.query(DailyReports).filter(
        DailyReports.user_id == current_user_id,
        DailyReports.date >= datetime.combine(normalized_week_start, datetime.min.time()),
        DailyReports.date < datetime.combine(next_week_start, datetime.min.time()),
    ).all()

    report_markdown = render_weekly_report_from_record(weekly_report)
    response_payload = build_weekly_report_response_payload(
        week_start=normalized_week_start,
        report_source={
            "ai_score": weekly_report.ai_score,
            "checkin_count": weekly_report.checkin_count,
            "analysis": weekly_report.analysis,
            "main_activity_time": weekly_report.main_activity_time,
            "better_day": weekly_report.better_day,
            "try_area": weekly_report.try_area,
            "ai_comment": weekly_report.ai_comment,
        },
        snapshots=snapshot_rows,
        checkins=checkin_rows,
        daily_reports=daily_report_rows,
        report_markdown=report_markdown,
    )
    return WeeklyReportResponse(
        week_start=normalized_week_start.isoformat(),
        status="DONE",
        **response_payload,
        issues=[],
    )

