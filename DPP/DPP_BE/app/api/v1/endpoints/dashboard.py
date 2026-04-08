from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usage_log import Daily_SnapShots, UsageLog
from app.models.user import User_Configs, Users
from app.utils.checkin_policy import (
    CANONICAL_PACKAGE_NAME,
    current_logical_date,
    logical_date_bounds,
    policy_from_config,
)

router = APIRouter()


def _ms_to_iso(ms: Optional[int]) -> Optional[str]:
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
    except (OSError, ValueError, OverflowError):
        return None


# 대시보드 요약 정보 API
@router.get("/dashboard/summary/{user_id}", response_model=dict)
def get_dashboard_summary(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="본인 대시보드만 조회할 수 있습니다.")

    user_config = db.query(User_Configs).filter(User_Configs.user_id == user_id).first()
    policy = policy_from_config(user_config)
    today = current_logical_date(user_config)
    yesterday = today - timedelta(days=1)
    today_start, next_day_start = logical_date_bounds(
        today,
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )
    yesterday_start, _ = logical_date_bounds(
        yesterday,
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )

    current_snapshot = _get_canonical_snapshot(db, user_id, today)
    yesterday_snapshot = _get_canonical_snapshot(db, user_id, yesterday)

    # fallback 요약 (snapshot이 없을 때만 사용)
    stats = db.query(
        func.coalesce(func.sum(UsageLog.usage_duration), 0).label("total_time_seconds"),
        func.coalesce(func.max(UsageLog.unlock_count), 0).label("total_unlocks"),
    ).filter(
        UsageLog.user_id == user_id,
        UsageLog.date >= today_start,
        UsageLog.date < next_day_start,
    ).first()

    ystats = db.query(
        func.coalesce(func.sum(UsageLog.usage_duration), 0).label("total_time_seconds"),
        func.coalesce(func.max(UsageLog.unlock_count), 0).label("total_unlocks"),
    ).filter(
        UsageLog.user_id == user_id,
        UsageLog.date >= yesterday_start,
        UsageLog.date < today_start,
    ).first()

    total_time_seconds = (
        int(current_snapshot.total_usage_check or 0)
        if current_snapshot
        else int(stats.total_time_seconds or 0)
    )
    total_unlocks = (
        int(current_snapshot.unlock_count or 0)
        if current_snapshot
        else int(stats.total_unlocks or 0)
    )
    yesterday_time_seconds = (
        int(yesterday_snapshot.total_usage_check or 0)
        if yesterday_snapshot
        else int(ystats.total_time_seconds or 0)
    )
    yesterday_unlocks = (
        int(yesterday_snapshot.unlock_count or 0)
        if yesterday_snapshot
        else int(ystats.total_unlocks or 0)
    )

    per_app_rows = _snapshot_per_app_rows(current_snapshot)
    if per_app_rows:
        most_used_item = max(per_app_rows, key=lambda item: int(item.get("usage_sec") or 0))
        most_used_name = _display_name(most_used_item)
        most_used_minutes = int(round(int(most_used_item.get("usage_sec") or 0) / 60))
        most_used_package = _package_name(most_used_item)
        top_visited = [
            {
                "name": _display_name(item),
                "count": int(item.get("launch_count") or 0),
                "package_name": _package_name(item),
            }
            for item in sorted(
                per_app_rows,
                key=lambda item: (
                    int(item.get("launch_count") or 0),
                    int(item.get("usage_sec") or 0),
                ),
                reverse=True,
            )[:3]
        ]
    else:
        most_used = db.query(
            UsageLog.package_name,
            UsageLog.app_name,
            func.coalesce(func.sum(UsageLog.usage_duration), 0).label("total_duration_seconds"),
        ).filter(
            UsageLog.user_id == user_id,
            UsageLog.date >= today_start,
            UsageLog.date < next_day_start,
        ).group_by(
            UsageLog.package_name,
            UsageLog.app_name,
        ).order_by(
            desc(text("total_duration_seconds"))
        ).first()

        most_used_name = "데이터 없음"
        most_used_minutes = 0
        most_used_package: Optional[str] = None
        if most_used:
            most_used_package = most_used.package_name
            most_used_name = (
                most_used.app_name
                if most_used.app_name and most_used.app_name != "Unknown"
                else most_used.package_name
            )
            most_used_minutes = int(round(int(most_used.total_duration_seconds or 0) / 60))

        top_visited_rows = db.query(
            UsageLog.package_name,
            UsageLog.app_name,
            func.coalesce(func.max(UsageLog.app_launch_count), 0).label("launch_count"),
        ).filter(
            UsageLog.user_id == user_id,
            UsageLog.date >= today_start,
            UsageLog.date < next_day_start,
        ).group_by(
            UsageLog.package_name,
            UsageLog.app_name,
        ).order_by(
            desc(text("launch_count"))
        ).limit(3).all()

        top_visited = [
            {
                "name": (row.app_name if row.app_name and row.app_name != "Unknown" else row.package_name),
                "count": int(row.launch_count or 0),
                "package_name": row.package_name,
            }
            for row in (top_visited_rows or [])
        ]

    longest_row = (
        db.query(UsageLog)
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.date >= today_start,
            UsageLog.date < next_day_start,
        )
        .order_by(desc(UsageLog.max_continuous_duration), desc(UsageLog.id))
        .first()
    )
    longest_session_seconds = (
        int(current_snapshot.max_continuous_sec or 0)
        if current_snapshot
        else int(longest_row.max_continuous_duration or 0) if longest_row else 0
    )
    longest_session_start: Optional[str] = None
    longest_session_end: Optional[str] = None
    if longest_row and longest_session_seconds > 0:
        longest_session_start = _ms_to_iso(longest_row.first_time_stamp)
        longest_session_end = _ms_to_iso(longest_row.last_time_stamp)

    return {
        "summary": {
            "total_time": int(round(total_time_seconds / 60)),
            "total_unlocks": total_unlocks,
            "longest_session": int(round(int(longest_session_seconds) / 60)),
            "longest_session_start": longest_session_start,
            "longest_session_end": longest_session_end,
            "yesterday_total_time": int(round(yesterday_time_seconds / 60)),
            "yesterday_total_unlocks": yesterday_unlocks,
        },
        "most_used_app": {
            "name": most_used_name,
            "minutes": most_used_minutes,
            "package_name": most_used_package,
        },
        "top_visited": top_visited,
    }


def _get_canonical_snapshot(db: Session, user_id: int, target_date: date) -> Optional[Daily_SnapShots]:
    return (
        db.query(Daily_SnapShots)
        .filter(
            Daily_SnapShots.user_id == user_id,
            Daily_SnapShots.snapshot_date == target_date,
            Daily_SnapShots.package_name == CANONICAL_PACKAGE_NAME,
        )
        .first()
    )


def _snapshot_per_app_rows(snapshot: Optional[Daily_SnapShots]) -> List[Dict[str, Any]]:
    if not snapshot or not isinstance(snapshot.per_app_usage_json, list):
        return []
    return [item for item in snapshot.per_app_usage_json if isinstance(item, dict)]


def _display_name(item: Dict[str, Any]) -> str:
    app_name = str(item.get("app_name") or "").strip()
    package_name = _package_name(item)
    if app_name and app_name != "Unknown":
        return app_name
    return package_name or "데이터 없음"


def _package_name(item: Dict[str, Any]) -> Optional[str]:
    package_name = str(item.get("package_name") or "").strip()
    return package_name or None


