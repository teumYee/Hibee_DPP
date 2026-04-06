import json
import os
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Tuple

import requests
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.calendar import CheckIn
from app.models.reports import DailyReports, ExpertKnowledge, WeeklyReports
from app.models.usage_log import Daily_SnapShots
from app.models.user import User_Configs
from services.ai_client import run_report_pipeline_via_ai_service


OPENAI_CHAT_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_EMBEDDING_API_URL = "https://api.openai.com/v1/embeddings"
CANONICAL_TIME_OF_DAY_BUCKETS = ("morning", "afternoon", "evening", "night")
TIME_OF_DAY_BUCKET_ALIASES = {
    "morning": "morning",
    "afternoon": "afternoon",
    "evening": "evening",
    "night": "night",
    "아침": "morning",
    "오전": "morning",
    "오후": "afternoon",
    "저녁": "evening",
    "밤": "night",
    "새벽": "night",
    "06-09": "morning",
    "09-12": "morning",
    "12-18": "afternoon",
    "18-22": "evening",
    "22-24": "night",
    "00-06": "night",
    "06-12": "morning",
}


def _safe_json_loads(text: str, default: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        return default


def _call_openai_chat(model: str, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    resp = requests.post(OPENAI_CHAT_API_URL, headers=headers, json=payload, timeout=25)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _call_openai_embedding(text: str, model: str = "text-embedding-3-small") -> List[float]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    payload = {"model": model, "input": text}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    resp = requests.post(OPENAI_EMBEDDING_API_URL, headers=headers, json=payload, timeout=25)
    resp.raise_for_status()
    data = resp.json()
    return data["data"][0]["embedding"]


def _serialize_user_config(user_config: User_Configs | None) -> Dict[str, Any]:
    return {
        "goals": user_config.goals if user_config else [],
        "active_times": user_config.active_times if user_config else [],
        "struggles": user_config.struggles if user_config else [],
        "night_mode_start": user_config.night_mode_start if user_config else "23:00",
        "night_mode_end": user_config.night_mode_end if user_config else "07:00",
        "checkin_time": user_config.checkin_time if user_config else "21:00",
    }


def _fallback_rag(snapshot: Daily_SnapShots, checkin: CheckIn, user_config: User_Configs | None = None) -> Dict[str, Any]:
    user_config_payload = _serialize_user_config(user_config)
    struggles = user_config_payload.get("struggles") or []
    goals = user_config_payload.get("goals") or []
    profile_hint = " ".join(
        str(item)
        for item in [
            *goals[:2],
            *struggles[:2],
            user_config_payload.get("checkin_time"),
        ]
        if item
    ).strip()
    return {
        "queries": [
            f"unlock_count {snapshot.unlock_count} habit improvement",
            f"max_continuous_sec {snapshot.max_continuous_sec} reduce overuse",
            f"{profile_hint} digital wellbeing routine" if profile_hint else "digital wellbeing routine",
        ],
        "filters": {
            "domain": "digital_wellbeing",
            "lang": "ko",
            "checkin_time": user_config_payload.get("checkin_time"),
        },
        "must_include_concepts": ["근거 기반", "실행 가능한 한 줄 행동"],
        "retrieved_evidence": [
            {"doc_id": "tpl_daily_01", "title": "일일 사용 습관 피드백 템플릿"},
            {"doc_id": "guide_focus_03", "title": "집중력 회복 가이드"},
        ],
    }


def _plan_rag_queries(
    snapshot: Daily_SnapShots,
    checkin: CheckIn,
    user_config: User_Configs | None = None,
) -> Dict[str, Any]:
    fallback = _fallback_rag(snapshot, checkin, user_config)
    try:
        system_prompt = (
            "You are a RAG query planner. Return strict JSON only with keys: "
            "queries(list[str]), filters(dict), must_include_concepts(list[str])."
        )
        snapshot_payload = {
            "total_usage_check": snapshot.total_usage_check,
            "unlock_count": snapshot.unlock_count,
            "max_continuous_sec": snapshot.max_continuous_sec,
            "app_launch_count": snapshot.app_launch_count,
        }
        checkin_payload = {
            "kpt_keep": checkin.kpt_keep,
            "kpt_problem": checkin.kpt_problem,
            "kpt_try": checkin.kpt_try,
            "selected_patterns": checkin.selected_patterns or [],
        }
        user_config_payload = _serialize_user_config(user_config)
        user_prompt = (
            f"snapshot={json.dumps(snapshot_payload, ensure_ascii=False)}\n"
            f"checkin={json.dumps(checkin_payload, ensure_ascii=False)}\n"
            f"user_config={json.dumps(user_config_payload, ensure_ascii=False)}"
        )
        raw = _call_openai_chat("gpt-4o-mini", system_prompt, user_prompt, temperature=0.1)
        parsed = _safe_json_loads(raw, fallback)
        parsed.setdefault("queries", fallback["queries"])
        parsed.setdefault("filters", fallback["filters"])
        parsed.setdefault("must_include_concepts", fallback["must_include_concepts"])
        return parsed
    except Exception:
        return {
            "queries": fallback["queries"],
            "filters": fallback["filters"],
            "must_include_concepts": fallback["must_include_concepts"],
        }


def _hybrid_search_expert_knowledge(db: Session, queries: List[str], top_k: int = 5, rrf_k: int = 60) -> List[Dict[str, Any]]:
    score_map: Dict[int, Dict[str, Any]] = {}

    for query_text in queries:
        vector_rows = []
        try:
            query_embedding = _call_openai_embedding(query_text)
            vector_rows = (
                db.query(ExpertKnowledge)
                .filter(ExpertKnowledge.embedding.isnot(None))
                .order_by(ExpertKnowledge.embedding.cosine_distance(query_embedding))
                .limit(top_k)
                .all()
            )
        except Exception:
            vector_rows = []

        document_text = func.concat_ws(" ", func.coalesce(ExpertKnowledge.category, ""), ExpertKnowledge.content)
        ts_vector = func.to_tsvector("simple", document_text)
        ts_query = func.plainto_tsquery("simple", query_text)
        fts_rows = (
            db.query(
                ExpertKnowledge,
                func.ts_rank_cd(ts_vector, ts_query).label("fts_rank"),
            )
            .filter(ts_vector.op("@@")(ts_query))
            .order_by(desc("fts_rank"))
            .limit(top_k)
            .all()
        )

        for rank, row in enumerate(vector_rows, start=1):
            score = 1.0 / (rrf_k + rank)
            entry = score_map.setdefault(
                row.id,
                {
                    "doc_id": f"expert_knowledge:{row.id}",
                    "title": row.category or f"expert_knowledge_{row.id}",
                    "content": row.content,
                    "metadata": row.metadata_ or {},
                    "rrf_score": 0.0,
                    "matched_queries": [],
                },
            )
            entry["rrf_score"] += score
            if query_text not in entry["matched_queries"]:
                entry["matched_queries"].append(query_text)

        for rank, (row, _fts_rank) in enumerate(fts_rows, start=1):
            score = 1.0 / (rrf_k + rank)
            entry = score_map.setdefault(
                row.id,
                {
                    "doc_id": f"expert_knowledge:{row.id}",
                    "title": row.category or f"expert_knowledge_{row.id}",
                    "content": row.content,
                    "metadata": row.metadata_ or {},
                    "rrf_score": 0.0,
                    "matched_queries": [],
                },
            )
            entry["rrf_score"] += score
            if query_text not in entry["matched_queries"]:
                entry["matched_queries"].append(query_text)

    ranked = sorted(score_map.values(), key=lambda item: item["rrf_score"], reverse=True)
    return ranked[:top_k]


def run_rag_agent(
    snapshot: Daily_SnapShots,
    checkin: CheckIn,
    user_config: User_Configs | None,
    db: Session,
) -> Dict[str, Any]:
    fallback = _fallback_rag(snapshot, checkin, user_config)
    plan = _plan_rag_queries(snapshot, checkin, user_config)
    queries = plan.get("queries") or fallback["queries"]
    filters = plan.get("filters") or fallback["filters"]
    must_include = plan.get("must_include_concepts") or fallback["must_include_concepts"]

    retrieved_evidence = _hybrid_search_expert_knowledge(db, queries)
    if not retrieved_evidence:
        retrieved_evidence = fallback["retrieved_evidence"]

    return {
        "queries": queries,
        "filters": filters,
        "must_include_concepts": must_include,
        "retrieved_evidence": retrieved_evidence,
    }

def _fallback_report_markdown(snapshot: Daily_SnapShots, checkin: CheckIn) -> str:
    return (
        "# 데일리 리포트\n\n"
        f"- 총 사용 지표: {snapshot.total_usage_check}\n"
        f"- 잠금 해제 횟수: {snapshot.unlock_count}\n"
        f"- 최장 연속 사용(초): {snapshot.max_continuous_sec}\n\n"
        f"## KPT 요약\n- Keep: {checkin.kpt_keep or '기록 없음'}\n"
        f"- Problem: {checkin.kpt_problem or '기록 없음'}\n"
        f"- Try: {checkin.kpt_try or '기록 없음'}\n\n"
        "## 오늘의 제안\n- 다음 사용 세션 시작 전에 목표를 1줄로 적어보세요.\n"
        "- 연속 사용이 길어질 때는 3분 휴식을 먼저 넣어보세요.\n"
    )


def _normalize_bucket_values(raw_buckets: Any) -> Dict[str, int]:
    if not isinstance(raw_buckets, dict):
        return {bucket: 0 for bucket in CANONICAL_TIME_OF_DAY_BUCKETS}

    normalized: Dict[str, int] = {bucket: 0 for bucket in CANONICAL_TIME_OF_DAY_BUCKETS}
    for key, value in raw_buckets.items():
        canonical_key = TIME_OF_DAY_BUCKET_ALIASES.get(str(key).strip(), str(key).strip())
        if canonical_key not in normalized:
            continue
        try:
            normalized[canonical_key] += int(value or 0)
        except (TypeError, ValueError):
            continue
    return normalized


def _markdown_to_plain_text(markdown: str | None) -> str | None:
    if not markdown:
        return None

    plain_lines: List[str] = []
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = line.lstrip("#").strip()
        if line.startswith("- "):
            line = line[2:].strip()
        plain_lines.append(line)

    return "\n".join(plain_lines) if plain_lines else None


def build_daily_report_response_payload(
    target_date: date,
    snapshot: Daily_SnapShots,
    checkin: CheckIn,
    report_markdown: str | None,
) -> Dict[str, Any]:
    bucket_values = _normalize_bucket_values(snapshot.time_of_day_buckets_json)
    selected_patterns = checkin.selected_patterns or []
    selected_titles = [
        pattern.get("title") or pattern.get("label")
        for pattern in selected_patterns
        if isinstance(pattern, dict) and (pattern.get("title") or pattern.get("label"))
    ]

    summary = (
        f"{target_date.isoformat()} 기준 총 사용 지표는 {snapshot.total_usage_check or 0}, "
        f"잠금 해제는 {snapshot.unlock_count or 0}회이며 "
        f"최장 연속 사용은 {snapshot.max_continuous_sec or 0}초였습니다."
    )

    highlights = [
        f"앱 실행 수는 {snapshot.app_launch_count or 0}회입니다.",
        (
            "선택한 패턴은 "
            + ", ".join(selected_titles)
            if selected_titles
            else "선택한 패턴 기록이 없습니다."
        ),
        f"KPT Problem: {checkin.kpt_problem or '기록 없음'}",
    ]

    recommendations: List[str] = []
    if checkin.kpt_try and checkin.kpt_try.strip():
        recommendations.append(checkin.kpt_try.strip())

    for pattern in selected_patterns:
        if not isinstance(pattern, dict):
            continue
        description = str(
            pattern.get("description")
            or pattern.get("interpretation")
            or pattern.get("observation")
            or ""
        ).strip()
        if description and description not in recommendations:
            recommendations.append(description)

    if not recommendations:
        recommendations = [
            "다음 사용 세션 전에 목표를 한 줄로 적어보세요.",
            "연속 사용이 길어지기 전에 짧은 휴식 알림을 설정해 보세요.",
        ]

    return {
        "report_markdown": report_markdown,
        "report_text": _markdown_to_plain_text(report_markdown) or summary,
        "summary": summary,
        "highlights": highlights,
        "recommendations": recommendations[:3],
        "chart_data": {
            "total_usage_check": snapshot.total_usage_check or 0,
            "unlock_count": snapshot.unlock_count or 0,
            "max_continuous_sec": snapshot.max_continuous_sec or 0,
            "app_launch_count": snapshot.app_launch_count or 0,
            "time_of_day_buckets": bucket_values,
        },
    }


def run_daily_report_pipeline(
    snapshot: Daily_SnapShots,
    checkin: CheckIn,
    user_config: User_Configs | None,
    db: Session,
) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
    rag_result = run_rag_agent(snapshot, checkin, user_config, db)

    snapshot_payload = {
        "date": snapshot.snapshot_date.isoformat() if snapshot.snapshot_date else "",
        "total_usage_sec": snapshot.total_usage_check,
        "total_usage_check": snapshot.total_usage_check,
        "unlock_count": snapshot.unlock_count,
        "max_continuous_sec": snapshot.max_continuous_sec,
        "app_launch_count": snapshot.app_launch_count,
        "time_of_day_buckets_sec": snapshot.time_of_day_buckets_json or snapshot.time_of_day_buckets_sec,
    }
    pipeline_input = {
        "snapshot": snapshot_payload,
        "user_configs": _serialize_user_config(user_config),
        "selected_patterns": checkin.selected_patterns or [],
        "kpt": {
            "keep": checkin.kpt_keep,
            "problem": checkin.kpt_problem,
            "try": checkin.kpt_try,
        },
        "retrieved_evidence": rag_result.get("retrieved_evidence", []),
    }

    try:
        pipeline_result = run_report_pipeline_via_ai_service(pipeline_input)
        report_markdown = pipeline_result.get("report_markdown") or _fallback_report_markdown(snapshot, checkin)
        judge_results = pipeline_result.get("judge_results") or []
        last_judge = judge_results[-1] if judge_results else {}
        review_result = {
            "verdict": pipeline_result.get("final_verdict", "FALLBACK"),
            "issues": last_judge.get("issues", []),
            "rewrite_brief": last_judge.get("rewrite_brief", ""),
        }
    except Exception as exc:
        report_markdown = _fallback_report_markdown(snapshot, checkin)
        review_result = {
            "verdict": "FALLBACK",
            "issues": [f"DPP_AI service call failed: {exc}"],
            "rewrite_brief": "",
        }

    return rag_result, report_markdown, review_result


def normalize_week_start(target_date: date) -> date:
    return target_date - timedelta(days=target_date.weekday())


def _format_bucket_name(bucket_key: str) -> str:
    mapping = {
        "morning": "아침",
        "afternoon": "오후",
        "evening": "저녁",
        "night": "밤",
    }
    return mapping.get(bucket_key, bucket_key)


def _build_weekly_evidence_refs(
    week_start: date,
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


def render_weekly_report_markdown(
    week_start: date,
    ai_score: float | None,
    checkin_count: int,
    analysis: str | None,
    main_activity_time: str | None,
    better_day: str | None,
    try_area: str | None,
    ai_comment: str | None,
) -> str:
    week_end = week_start + timedelta(days=6)
    score_text = f"{ai_score:.1f}" if ai_score is not None else "-"

    return (
        "# 주간 리포트\n\n"
        f"- 기간: {week_start.isoformat()} ~ {week_end.isoformat()}\n"
        f"- AI 점수: {score_text}\n"
        f"- 완료 체크인 수: {checkin_count}\n"
        f"- 주요 활동 시간대: {main_activity_time or '데이터 없음'}\n"
        f"- 가장 안정적인 날: {better_day or '데이터 없음'}\n\n"
        "## 이번 주 분석\n"
        f"{analysis or '분석 데이터가 없습니다.'}\n\n"
        "## 다음 주 집중 영역\n"
        f"{try_area or '작은 습관 하나를 꾸준히 유지하는 데 집중해 보세요.'}\n\n"
        "## 한 줄 코멘트\n"
        f"{ai_comment or '이번 주 기록을 바탕으로 다음 주도 같은 시간대 패턴을 점검해 보세요.'}\n"
    )


def render_weekly_report_from_record(record: WeeklyReports) -> str:
    return render_weekly_report_markdown(
        week_start=date.fromisoformat(record.date_week),
        ai_score=record.ai_score,
        checkin_count=record.checkin_count or 0,
        analysis=record.analysis,
        main_activity_time=record.main_activity_time,
        better_day=record.better_day,
        try_area=record.try_area,
        ai_comment=record.ai_comment,
    )


def build_weekly_report_response_payload(
    week_start: date,
    report_source: Dict[str, Any],
    snapshots: List[Daily_SnapShots],
    checkins: List[CheckIn],
    daily_reports: List[DailyReports],
    report_markdown: str | None,
) -> Dict[str, Any]:
    bucket_totals: Counter[str] = Counter()
    daily_usage: Dict[str, int] = {}
    total_usage = 0
    total_unlocks = 0
    total_launches = 0
    max_continuous = 0

    for snapshot in snapshots:
        usage = snapshot.total_usage_check or 0
        total_usage += usage
        total_unlocks += snapshot.unlock_count or 0
        total_launches += snapshot.app_launch_count or 0
        max_continuous = max(max_continuous, snapshot.max_continuous_sec or 0)

        if snapshot.snapshot_date:
            day_key = snapshot.snapshot_date.isoformat()
            daily_usage[day_key] = daily_usage.get(day_key, 0) + usage

        for bucket_name, bucket_value in _normalize_bucket_values(snapshot.time_of_day_buckets_json).items():
            bucket_totals[bucket_name] += bucket_value

    tracked_days = len(daily_usage)
    avg_daily_usage = round(total_usage / tracked_days) if tracked_days else 0
    avg_daily_unlocks = round(total_unlocks / tracked_days) if tracked_days else 0
    ai_score = float(report_source.get("ai_score") or 0)
    checkin_count = int(report_source.get("checkin_count") or 0)
    main_activity_time = report_source.get("main_activity_time") or "데이터 없음"
    better_day = report_source.get("better_day") or "데이터 없음"
    try_area = report_source.get("try_area") or "작은 습관 하나를 꾸준히 유지해 보세요."
    summary = report_source.get("analysis") or (
        f"이번 주 총 사용 지표는 {total_usage}, 평균 사용 지표는 {avg_daily_usage}, "
        f"완료 체크인은 {checkin_count}회입니다."
    )

    insights = [
        f"AI 점수는 {ai_score:.1f}점입니다.",
        f"주요 활동 시간대는 {main_activity_time}입니다.",
        f"비교적 안정적인 날은 {better_day}입니다.",
    ]
    next_actions = [
        try_area,
        report_source.get("ai_comment") or "다음 주에도 같은 시간대 패턴을 비교해 보세요.",
    ]

    plain_text = _markdown_to_plain_text(report_markdown)
    if not plain_text:
        plain_text = "\n".join([summary, *insights, *next_actions])

    return {
        "report_markdown": report_markdown,
        "report_text": plain_text,
        "summary": summary,
        "insights": insights,
        "next_actions": next_actions,
        "chart_data": {
            "ai_score": ai_score,
            "checkin_count": checkin_count,
            "total_usage_check": total_usage,
            "avg_daily_usage": avg_daily_usage,
            "avg_daily_unlock_count": avg_daily_unlocks,
            "total_app_launch_count": total_launches,
            "max_continuous_sec": max_continuous,
            "time_of_day_buckets": dict(bucket_totals),
            "daily_usage": daily_usage,
        },
        "evidence_refs": _build_weekly_evidence_refs(week_start, snapshots, checkins, daily_reports),
    }


def build_weekly_report(
    week_start: date,
    snapshots: List[Daily_SnapShots],
    checkins: List[CheckIn],
    daily_reports: List[DailyReports],
) -> Dict[str, Any]:
    if not daily_reports:
        raise ValueError("주간 리포트를 생성하려면 해당 주의 데일리 리포트가 먼저 있어야 합니다.")
    if not snapshots and not checkins:
        raise ValueError("주간 리포트를 생성할 스냅샷 또는 체크인 데이터가 없습니다.")

    bucket_totals: Counter[str] = Counter()
    daily_usage_totals: Dict[date, int] = defaultdict(int)

    total_usage = 0
    total_unlocks = 0
    total_launches = 0
    max_continuous = 0

    for snapshot in snapshots:
        usage = snapshot.total_usage_check or 0
        total_usage += usage
        total_unlocks += snapshot.unlock_count or 0
        total_launches += snapshot.app_launch_count or 0
        max_continuous = max(max_continuous, snapshot.max_continuous_sec or 0)

        if snapshot.snapshot_date:
            daily_usage_totals[snapshot.snapshot_date] += usage

        if isinstance(snapshot.time_of_day_buckets_json, dict):
            for bucket_name, bucket_value in snapshot.time_of_day_buckets_json.items():
                bucket_totals[bucket_name] += int(bucket_value or 0)

    checkin_days = {checkin.date for checkin in checkins if checkin.is_completed}
    checkin_count = len(checkin_days)
    tracked_days = len({snapshot.snapshot_date for snapshot in snapshots if snapshot.snapshot_date})
    daily_report_days = len({report.date.date() for report in daily_reports if report.date})
    avg_usage = round(total_usage / tracked_days) if tracked_days else 0
    avg_unlocks = round(total_unlocks / tracked_days) if tracked_days else 0

    main_activity_bucket = bucket_totals.most_common(1)[0][0] if bucket_totals else None
    main_activity_time = _format_bucket_name(main_activity_bucket) if main_activity_bucket else "데이터 없음"

    better_day = None
    if daily_usage_totals:
        better_day = min(
            daily_usage_totals.items(),
            key=lambda item: (
                0 if item[0] in checkin_days else 1,
                item[1],
                item[0].isoformat(),
            ),
        )[0].isoformat()

    try_candidates = [checkin.kpt_try.strip() for checkin in checkins if checkin.kpt_try and checkin.kpt_try.strip()]
    problem_candidates = [
        checkin.kpt_problem.strip() for checkin in checkins if checkin.kpt_problem and checkin.kpt_problem.strip()
    ]
    try_area = None
    if try_candidates:
        try_area = Counter(try_candidates).most_common(1)[0][0]
    elif problem_candidates:
        try_area = f"문제 영역: {Counter(problem_candidates).most_common(1)[0][0]}"

    completion_ratio = checkin_count / 7.0
    coverage_ratio = min(daily_report_days / 7.0, 1.0)
    ai_score = round((completion_ratio * 70.0) + (coverage_ratio * 30.0), 1)

    analysis = (
        f"이번 주에는 {daily_report_days}일의 데일리 리포트와 {tracked_days}일의 스냅샷, "
        f"{checkin_count}회의 완료 체크인이 기록되었습니다. "
        f"일평균 사용 지표는 {avg_usage}, 일평균 잠금 해제 수는 {avg_unlocks}였고 "
        f"가장 두드러진 활동 시간대는 {main_activity_time}였습니다. "
        f"최장 연속 사용은 {max_continuous}초, 전체 앱 실행 수는 {total_launches}회였습니다."
    )
    if better_day:
        analysis += f" 비교적 안정적이었던 날은 {better_day}입니다."

    ai_comment = (
        f"이번 주 점수는 {ai_score:.1f}점입니다. "
        f"{'완료 체크인 흐름이 유지되고 있습니다.' if checkin_count >= 4 else '체크인 빈도를 조금만 더 올리면 주간 흐름이 더 선명해집니다.'}"
    )

    report_markdown = render_weekly_report_markdown(
        week_start=week_start,
        ai_score=ai_score,
        checkin_count=checkin_count,
        analysis=analysis,
        main_activity_time=main_activity_time,
        better_day=better_day,
        try_area=try_area,
        ai_comment=ai_comment,
    )

    return {
        "week_start": week_start.isoformat(),
        "ai_score": ai_score,
        "checkin_count": checkin_count,
        "analysis": analysis,
        "main_activity_time": main_activity_time,
        "better_day": better_day,
        "try_area": try_area,
        "ai_comment": ai_comment,
        "report_markdown": report_markdown,
        "evidence_refs": _build_weekly_evidence_refs(week_start, snapshots, checkins, daily_reports),
    }
