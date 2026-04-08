"""
expert_knowledge 기반 AI-direct retrieval.

- DPP_AI 내부에서 질의 계획(query planning)
- expert_knowledge에 대한 hybrid search(vector + FTS)
- writer / judge에 전달할 evidence 메타 반환
"""
import json
import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, Iterator, List, Optional

from openai import OpenAI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal

logger = logging.getLogger("dpp_ai")

DEFAULT_QUERY_PLANNER_MODEL = "gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_TOP_K = 5
RRF_K = 60
MAX_QUERY_COUNT = 4
MAX_CONCEPT_COUNT = 6
MAX_EVIDENCE_CHARS = 1200
GENERIC_FALLBACK_QUERIES = [
    "digital wellbeing routine",
    "스마트폰 사용 자기인식",
]


@contextmanager
def _session_scope(db_session: Optional[Session] = None) -> Iterator[Optional[Session]]:
    if db_session is not None:
        yield db_session
        return
    if SessionLocal is None:
        yield None
        return
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _compact_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(snapshot, dict):
        return {}
    return {
        "date": snapshot.get("date"),
        "total_usage_sec": snapshot.get("total_usage_sec") or snapshot.get("total_usage_check"),
        "unlock_count": snapshot.get("unlock_count"),
        "max_continuous_sec": snapshot.get("max_continuous_sec"),
        "app_launch_count": snapshot.get("app_launch_count"),
        "time_of_day_buckets_sec": snapshot.get("time_of_day_buckets_sec"),
        "top_apps_json": snapshot.get("top_apps_json"),
    }


def _compact_user_config(user_configs: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(user_configs, dict):
        return {}
    return {
        "goals": user_configs.get("goals") or [],
        "struggles": user_configs.get("struggles") or [],
        "active_times": user_configs.get("active_times") or [],
        "checkin_time": user_configs.get("checkin_time"),
        "day_rollover_time": user_configs.get("day_rollover_time"),
    }


def _compact_selected_patterns(selected_patterns: Any) -> List[Dict[str, Any]]:
    if not isinstance(selected_patterns, list):
        return []
    items: List[Dict[str, Any]] = []
    for pattern in selected_patterns[:5]:
        if not isinstance(pattern, dict):
            continue
        items.append(
            {
                "label": pattern.get("label"),
                "observation": pattern.get("observation"),
                "interpretation": pattern.get("interpretation"),
                "tags": pattern.get("tags") or [],
            }
        )
    return items


def _compact_behavior_breakdown(behavior_breakdown: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(behavior_breakdown, dict):
        return {}
    return {
        "per_app": behavior_breakdown.get("per_app") or [],
        "per_category": behavior_breakdown.get("per_category") or [],
        "time_distribution": behavior_breakdown.get("time_distribution") or {},
        "top_apps": behavior_breakdown.get("top_apps") or [],
    }


def _clean_string_list(values: Any, *, limit: int) -> List[str]:
    if not isinstance(values, list):
        return []
    cleaned: List[str] = []
    seen = set()
    for value in values:
        text_value = str(value or "").strip()
        if not text_value or text_value in seen:
            continue
        seen.add(text_value)
        cleaned.append(text_value)
        if len(cleaned) >= limit:
            break
    return cleaned


def _ensure_queries(values: Any, fallback_queries: List[str]) -> List[str]:
    ensured = _clean_string_list(values, limit=MAX_QUERY_COUNT)
    if ensured:
        return ensured
    ensured = _clean_string_list(fallback_queries, limit=MAX_QUERY_COUNT)
    if ensured:
        return ensured
    return list(GENERIC_FALLBACK_QUERIES[:MAX_QUERY_COUNT])


def _normalize_filters(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {"category_bias": []}
    return {
        "category_bias": _clean_string_list(value.get("category_bias"), limit=MAX_CONCEPT_COUNT),
    }


def _fallback_report_plan(
    snapshot: Dict[str, Any],
    selected_patterns: List[Dict[str, Any]],
    kpt: Dict[str, Any],
    user_configs: Dict[str, Any],
) -> Dict[str, Any]:
    queries: List[str] = []
    must_include: List[str] = []
    category_bias: List[str] = []

    goals = user_configs.get("goals") or []
    struggles = user_configs.get("struggles") or []
    if goals:
        queries.append(f"디지털 웰빙 목표 {' '.join(str(goal) for goal in goals[:3])}")
        must_include.extend(str(goal) for goal in goals[:3])
    if struggles:
        queries.append(f"스마트폰 사용 어려움 {' '.join(str(item) for item in struggles[:3])}")
        must_include.extend(str(item) for item in struggles[:3])

    top_apps = snapshot.get("top_apps_json") or []
    if isinstance(top_apps, list):
        app_names = [str(item.get("app_name") or item.get("package_name") or "").strip() for item in top_apps[:3] if isinstance(item, dict)]
        app_names = [name for name in app_names if name]
        if app_names:
            queries.append(f"앱 사용 패턴 {' '.join(app_names)}")
            must_include.extend(app_names[:2])

    for pattern in selected_patterns[:3]:
        label = str(pattern.get("label") or "").strip()
        if label:
            queries.append(f"행동 패턴 해석 {label}")
            must_include.append(label)
        for tag in pattern.get("tags") or []:
            tag_text = str(tag or "").strip()
            if tag_text:
                must_include.append(tag_text)

    for key in ("keep", "problem", "try"):
        value = str(kpt.get(key) or "").strip()
        if value:
            queries.append(f"회고 문장 해석 {value}")
            must_include.append(value[:80])

    if not queries:
        queries = [
            "디지털 웰빙 스마트폰 사용 패턴",
            "야간 스마트폰 사용 자기인식",
        ]

    if struggles:
        category_bias.extend(str(item) for item in struggles[:2])
    if not category_bias and goals:
        category_bias.extend(str(item) for item in goals[:2])

    return {
        "queries": _clean_string_list(queries, limit=MAX_QUERY_COUNT),
        "filters": {"category_bias": _clean_string_list(category_bias, limit=MAX_CONCEPT_COUNT)},
        "must_include_concepts": _clean_string_list(must_include, limit=MAX_CONCEPT_COUNT),
    }


def _fallback_checkin_plan(
    snapshot: Dict[str, Any],
    behavior_breakdown: Dict[str, Any],
    time_policy: Dict[str, Any],
    user_configs: Dict[str, Any],
) -> Dict[str, Any]:
    queries: List[str] = []
    must_include: List[str] = []
    category_bias: List[str] = []

    per_category = behavior_breakdown.get("per_category") or []
    if isinstance(per_category, list):
        category_names = [
            str(item.get("category") or item.get("name") or "").strip()
            for item in per_category[:3]
            if isinstance(item, dict)
        ]
        category_names = [name for name in category_names if name]
        if category_names:
            queries.append(f"카테고리 사용 패턴 {' '.join(category_names)}")
            category_bias.extend(category_names[:2])
            must_include.extend(category_names[:2])

    top_apps = behavior_breakdown.get("top_apps") or snapshot.get("top_apps_json") or []
    if isinstance(top_apps, list):
        app_names = [
            str(item.get("app_name") or item.get("package_name") or "").strip()
            for item in top_apps[:3]
            if isinstance(item, dict)
        ]
        app_names = [name for name in app_names if name]
        if app_names:
            queries.append(f"앱 몰입 패턴 {' '.join(app_names)}")
            must_include.extend(app_names[:2])

    time_distribution = behavior_breakdown.get("time_distribution") or snapshot.get("time_of_day_buckets_sec") or {}
    if isinstance(time_distribution, dict):
        heavy_buckets = sorted(
            time_distribution.items(),
            key=lambda item: int(item[1]) if str(item[1]).isdigit() else 0,
            reverse=True,
        )
        if heavy_buckets:
            bucket_names = [str(name) for name, _value in heavy_buckets[:2]]
            queries.append(f"시간대 사용 리듬 {' '.join(bucket_names)}")
            must_include.extend(bucket_names)

    logical_date = str(time_policy.get("logical_date") or "").strip()
    checkin_time = str(time_policy.get("checkin_time") or "").strip()
    if logical_date or checkin_time:
        queries.append(f"체크인 회고 시간대 {logical_date} {checkin_time}".strip())

    struggles = user_configs.get("struggles") or []
    if struggles:
        must_include.extend(str(item) for item in struggles[:3])
        if not category_bias:
            category_bias.extend(str(item) for item in struggles[:2])

    if not queries:
        queries = [
            "디지털 웰빙 행동 패턴 해석",
            "스마트폰 사용 리듬 체크인",
        ]

    return {
        "queries": _clean_string_list(queries, limit=MAX_QUERY_COUNT),
        "filters": {"category_bias": _clean_string_list(category_bias, limit=MAX_CONCEPT_COUNT)},
        "must_include_concepts": _clean_string_list(must_include, limit=MAX_CONCEPT_COUNT),
    }


def _plan_queries(mode: str, payload: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = os.getenv("RAG_QUERY_PLANNER_MODEL", DEFAULT_QUERY_PLANNER_MODEL)
    system_prompt = (
        "너는 expert_knowledge 검색 쿼리 플래너다. "
        "입력을 보고 관련 근거를 찾기 위한 검색 질의만 설계한다. "
        "반드시 JSON만 반환하고 키는 queries, filters, must_include_concepts만 사용한다. "
        "filters는 category_bias 배열만 포함한다. "
        "queries는 1~4개, must_include_concepts는 0~6개로 제한한다."
    )
    user_prompt = json.dumps(
        {
            "mode": mode,
            "input": payload,
            "fallback": fallback,
        },
        ensure_ascii=False,
    )
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = (response.choices[0].message.content or "").strip()
        parsed = json.loads(raw) if raw else {}
    except Exception as exc:
        logger.warning("evidence query planning failed (%s): %s", mode, exc)
        parsed = {}

    raw_queries = _clean_string_list(parsed.get("queries"), limit=MAX_QUERY_COUNT)
    queries = _ensure_queries(raw_queries, fallback["queries"])
    filters = _normalize_filters(parsed.get("filters"))
    if not filters.get("category_bias"):
        filters = fallback["filters"]
    must_include = (
        _clean_string_list(parsed.get("must_include_concepts"), limit=MAX_CONCEPT_COUNT)
        or fallback["must_include_concepts"]
    )
    return {
        "queries": queries,
        "filters": filters,
        "must_include_concepts": must_include,
        "retrieval_debug": {
            "planner_mode": mode,
            "planner_used_fallback_queries": not bool(raw_queries),
            "planner_used_fallback_filters": not bool(_normalize_filters(parsed.get("filters")).get("category_bias")),
            "planner_used_fallback_concepts": not bool(
                _clean_string_list(parsed.get("must_include_concepts"), limit=MAX_CONCEPT_COUNT)
            ),
        },
    }


def _call_embedding(text_value: str) -> List[float]:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = os.getenv("RAG_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
    response = client.embeddings.create(model=model, input=text_value)
    return response.data[0].embedding


def _vector_to_literal(vector: List[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"


def _truncate_content(content: str) -> str:
    text_value = str(content or "").strip()
    if len(text_value) <= MAX_EVIDENCE_CHARS:
        return text_value
    return text_value[: MAX_EVIDENCE_CHARS - 3].rstrip() + "..."


def _contains_concept(text_value: str, concept: str) -> bool:
    return concept.lower() in text_value.lower()


def _vector_search(session: Session, query_text: str, top_k: int) -> List[Dict[str, Any]]:
    try:
        embedding = _call_embedding(query_text)
        embedding_literal = _vector_to_literal(embedding)
        rows = session.execute(
            text(
                """
                SELECT
                    id,
                    category,
                    content,
                    metadata,
                    embedding <=> CAST(:embedding AS vector) AS distance
                FROM expert_knowledge
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
                """
            ),
            {"embedding": embedding_literal, "top_k": top_k},
        ).mappings().all()
        return [dict(row) for row in rows]
    except Exception as exc:
        logger.warning("vector search failed for query '%s': %s", query_text, exc)
        return []


def _fts_search(session: Session, query_text: str, top_k: int) -> List[Dict[str, Any]]:
    try:
        rows = session.execute(
            text(
                """
                SELECT
                    id,
                    category,
                    content,
                    metadata,
                    ts_rank_cd(
                        to_tsvector('simple', concat_ws(' ', coalesce(category, ''), coalesce(content, ''))),
                        plainto_tsquery('simple', :query_text)
                    ) AS fts_rank
                FROM expert_knowledge
                WHERE to_tsvector('simple', concat_ws(' ', coalesce(category, ''), coalesce(content, '')))
                    @@ plainto_tsquery('simple', :query_text)
                ORDER BY fts_rank DESC
                LIMIT :top_k
                """
            ),
            {"query_text": query_text, "top_k": top_k},
        ).mappings().all()
        return [dict(row) for row in rows]
    except Exception as exc:
        logger.warning("fts search failed for query '%s': %s", query_text, exc)
        return []


def _boosted_score(entry: Dict[str, Any], filters: Dict[str, Any], must_include_concepts: List[str]) -> float:
    score = float(entry.get("rrf_score") or 0.0)
    content_blob = " ".join(
        [
            str(entry.get("title") or ""),
            str(entry.get("content") or ""),
            json.dumps(entry.get("metadata") or {}, ensure_ascii=False),
        ]
    )
    category = str(entry.get("title") or "")
    for category_bias in filters.get("category_bias") or []:
        if category_bias and _contains_concept(category, category_bias):
            score += 0.03
    for concept in must_include_concepts:
        if concept and _contains_concept(content_blob, concept):
            score += 0.02
    return score


def _hybrid_search_expert_knowledge(
    queries: List[str],
    filters: Dict[str, Any],
    must_include_concepts: List[str],
    *,
    top_k: int,
    db_session: Optional[Session] = None,
) -> Dict[str, Any]:
    if not queries:
        return {
            "retrieved_evidence": [],
            "retrieval_debug": {
                "retrieval_ran": False,
                "retrieval_skipped_reason": "empty_queries",
                "query_count": 0,
                "evidence_count": 0,
                "query_stats": [],
            },
        }

    with _session_scope(db_session) as session:
        if session is None:
            logger.info("DATABASE_URL not configured; returning empty retrieved_evidence")
            return {
                "retrieved_evidence": [],
                "retrieval_debug": {
                    "retrieval_ran": False,
                    "retrieval_skipped_reason": "missing_db_session",
                    "query_count": len(queries),
                    "evidence_count": 0,
                    "query_stats": [],
                },
            }

        score_map: Dict[int, Dict[str, Any]] = {}
        query_stats: List[Dict[str, Any]] = []
        for query_text in queries:
            vector_rows = _vector_search(session, query_text, top_k)
            fts_rows = _fts_search(session, query_text, top_k)
            query_stats.append(
                {
                    "query": query_text,
                    "vector_hits": len(vector_rows),
                    "fts_hits": len(fts_rows),
                }
            )
            for rank, row in enumerate(vector_rows, start=1):
                entry = score_map.setdefault(
                    int(row["id"]),
                    {
                        "doc_id": f"expert_knowledge:{row['id']}",
                        "title": row.get("category") or f"expert_knowledge_{row['id']}",
                        "content": _truncate_content(str(row.get("content") or "")),
                        "metadata": row.get("metadata") or {},
                        "matched_queries": [],
                        "retrieval_sources": [],
                        "rrf_score": 0.0,
                    },
                )
                entry["rrf_score"] += 1.0 / (RRF_K + rank)
                if query_text not in entry["matched_queries"]:
                    entry["matched_queries"].append(query_text)
                if "vector" not in entry["retrieval_sources"]:
                    entry["retrieval_sources"].append("vector")

            for rank, row in enumerate(fts_rows, start=1):
                entry = score_map.setdefault(
                    int(row["id"]),
                    {
                        "doc_id": f"expert_knowledge:{row['id']}",
                        "title": row.get("category") or f"expert_knowledge_{row['id']}",
                        "content": _truncate_content(str(row.get("content") or "")),
                        "metadata": row.get("metadata") or {},
                        "matched_queries": [],
                        "retrieval_sources": [],
                        "rrf_score": 0.0,
                    },
                )
                entry["rrf_score"] += 1.0 / (RRF_K + rank)
                if query_text not in entry["matched_queries"]:
                    entry["matched_queries"].append(query_text)
                if "fts" not in entry["retrieval_sources"]:
                    entry["retrieval_sources"].append("fts")

        ranked = sorted(
            score_map.values(),
            key=lambda item: _boosted_score(item, filters, must_include_concepts),
            reverse=True,
        )
        output: List[Dict[str, Any]] = []
        for item in ranked[:top_k]:
            final_score = _boosted_score(item, filters, must_include_concepts)
            output.append(
                {
                    "doc_id": item["doc_id"],
                    "title": item["title"],
                    "content": item["content"],
                    "metadata": item["metadata"],
                    "matched_queries": item["matched_queries"],
                    "retrieval_sources": item["retrieval_sources"],
                    "rrf_score": round(final_score, 6),
                }
            )
        return {
            "retrieved_evidence": output,
            "retrieval_debug": {
                "retrieval_ran": True,
                "retrieval_skipped_reason": None,
                "query_count": len(queries),
                "evidence_count": len(output),
                "query_stats": query_stats,
            },
        }


def retrieve_report_evidence(
    snapshot: Dict[str, Any],
    selected_patterns: List[Dict[str, Any]],
    kpt: Dict[str, Any],
    user_configs: Dict[str, Any],
    *,
    db_session: Optional[Session] = None,
) -> Dict[str, Any]:
    fallback = _fallback_report_plan(snapshot, selected_patterns, kpt, user_configs)
    payload = {
        "snapshot": _compact_snapshot(snapshot),
        "selected_patterns": _compact_selected_patterns(selected_patterns),
        "kpt": kpt if isinstance(kpt, dict) else {},
        "user_configs": _compact_user_config(user_configs),
    }
    plan = _plan_queries("report", payload, fallback)
    search_result = _hybrid_search_expert_knowledge(
        plan["queries"],
        plan["filters"],
        plan["must_include_concepts"],
        top_k=DEFAULT_TOP_K,
        db_session=db_session,
    )
    retrieved_evidence = search_result.get("retrieved_evidence", [])
    retrieval_debug = search_result.get("retrieval_debug", {})
    used_fallback_retrieval = False
    fallback_attempts: List[Dict[str, Any]] = []
    if not retrieved_evidence:
        retry_plans = [
            (
                "fallback_plan",
                _ensure_queries([], fallback["queries"]),
                fallback["filters"],
                fallback["must_include_concepts"],
            ),
            (
                "generic_queries",
                _ensure_queries([], GENERIC_FALLBACK_QUERIES),
                {"category_bias": []},
                [],
            ),
        ]
        for source, retry_queries, retry_filters, retry_must_include in retry_plans:
            if (
                retry_queries == plan["queries"]
                and retry_filters == plan["filters"]
                and retry_must_include == plan["must_include_concepts"]
            ):
                continue
            retry_result = _hybrid_search_expert_knowledge(
                retry_queries,
                retry_filters,
                retry_must_include,
                top_k=DEFAULT_TOP_K,
                db_session=db_session,
            )
            fallback_attempts.append(
                {
                    "source": source,
                    **(retry_result.get("retrieval_debug") or {}),
                }
            )
            if retry_result.get("retrieved_evidence"):
                used_fallback_retrieval = True
                retrieved_evidence = retry_result.get("retrieved_evidence", [])
                retrieval_debug = retry_result.get("retrieval_debug", {})
                plan["queries"] = retry_queries
                plan["filters"] = retry_filters
                plan["must_include_concepts"] = retry_must_include
                break
    return {
        "queries": plan["queries"],
        "filters": plan["filters"],
        "must_include_concepts": plan["must_include_concepts"],
        "retrieved_evidence": retrieved_evidence,
        "retrieval_debug": {
            **plan.get("retrieval_debug", {}),
            **retrieval_debug,
            "used_fallback_retrieval": used_fallback_retrieval,
            "fallback_attempts": fallback_attempts,
        },
    }


def retrieve_checkin_evidence(
    snapshot: Dict[str, Any],
    behavior_breakdown: Dict[str, Any],
    time_policy: Dict[str, Any],
    user_configs: Dict[str, Any],
    *,
    db_session: Optional[Session] = None,
) -> Dict[str, Any]:
    fallback = _fallback_checkin_plan(snapshot, behavior_breakdown, time_policy, user_configs)
    payload = {
        "snapshot": _compact_snapshot(snapshot),
        "behavior_breakdown": _compact_behavior_breakdown(behavior_breakdown),
        "time_policy": time_policy if isinstance(time_policy, dict) else {},
        "user_configs": _compact_user_config(user_configs),
    }
    plan = _plan_queries("checkin", payload, fallback)
    search_result = _hybrid_search_expert_knowledge(
        plan["queries"],
        plan["filters"],
        plan["must_include_concepts"],
        top_k=DEFAULT_TOP_K,
        db_session=db_session,
    )
    retrieved_evidence = search_result.get("retrieved_evidence", [])
    retrieval_debug = search_result.get("retrieval_debug", {})
    used_fallback_retrieval = False
    fallback_attempts: List[Dict[str, Any]] = []
    if not retrieved_evidence:
        retry_plans = [
            (
                "fallback_plan",
                _ensure_queries([], fallback["queries"]),
                fallback["filters"],
                fallback["must_include_concepts"],
            ),
            (
                "generic_queries",
                _ensure_queries([], GENERIC_FALLBACK_QUERIES),
                {"category_bias": []},
                [],
            ),
        ]
        for source, retry_queries, retry_filters, retry_must_include in retry_plans:
            if (
                retry_queries == plan["queries"]
                and retry_filters == plan["filters"]
                and retry_must_include == plan["must_include_concepts"]
            ):
                continue
            retry_result = _hybrid_search_expert_knowledge(
                retry_queries,
                retry_filters,
                retry_must_include,
                top_k=DEFAULT_TOP_K,
                db_session=db_session,
            )
            fallback_attempts.append(
                {
                    "source": source,
                    **(retry_result.get("retrieval_debug") or {}),
                }
            )
            if retry_result.get("retrieved_evidence"):
                used_fallback_retrieval = True
                retrieved_evidence = retry_result.get("retrieved_evidence", [])
                retrieval_debug = retry_result.get("retrieval_debug", {})
                plan["queries"] = retry_queries
                plan["filters"] = retry_filters
                plan["must_include_concepts"] = retry_must_include
                break
    return {
        "queries": plan["queries"],
        "filters": plan["filters"],
        "must_include_concepts": plan["must_include_concepts"],
        "retrieved_evidence": retrieved_evidence,
        "retrieval_debug": {
            **plan.get("retrieval_debug", {}),
            **retrieval_debug,
            "used_fallback_retrieval": used_fallback_retrieval,
            "fallback_attempts": fallback_attempts,
        },
    }
