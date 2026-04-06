from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func,desc,text
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional

from app import schemas
from app.core.database import get_db
from app.models.usage_log import UsageLog
from app.models.user import Users, User_App_Categories

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
def get_dashboard_summary(user_id: int, db: Session = Depends(get_db)):
    # today = datetime.now().date() 
    # test_date = date(2026, 1, 31) 
    # logs = db.query(UsageLog).filter(func.date(UsageLog.date) == test_date).all()
    today_start = datetime.combine(date.today(), datetime.min.time())
    next_day_start = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)

    # 1) summary — 사용시간은 합산, 언락은 일일 스칼라가 행에 중복 저장될 수 있어 MAX(과거 데이터·방어)
    stats = db.query(
        func.coalesce(func.sum(UsageLog.usage_duration), 0).label("total_time_seconds"),
        func.coalesce(func.max(UsageLog.unlock_count), 0).label("total_unlocks"),
    ).filter(
        UsageLog.user_id == user_id,
        UsageLog.date >= today_start,
        UsageLog.date < next_day_start,
    ).first()

    total_time_seconds = int(stats.total_time_seconds) if stats else 0
    total_unlocks = int(stats.total_unlocks) if stats else 0

    # 어제 하루(00:00~24:00) 합산 — 언락 비교·사용 시간 비교용 (동일 시각 누적은 로그 구조상 별도 설계 필요)
    ystats = db.query(
        func.coalesce(func.sum(UsageLog.usage_duration), 0).label("total_time_seconds"),
        func.coalesce(func.max(UsageLog.unlock_count), 0).label("total_unlocks"),
    ).filter(
        UsageLog.user_id == user_id,
        UsageLog.date >= yesterday_start,
        UsageLog.date < today_start,
    ).first()

    yesterday_time_seconds = int(ystats.total_time_seconds) if ystats else 0
    yesterday_unlocks = int(ystats.total_unlocks) if ystats else 0

    # 2) most_used_app — usage_duration 합산 기준 1개
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

    # 3) top_visited — 동기화마다 같은 앱에 여러 행이 쌓이면 SUM 이 과대해짐 → 일일 지표는 MAX 가 안전
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

    # 4) longest_session — max_continuous_duration 최대인 로그 1건 + 해당 로그의 구간(start/end)
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
        int(longest_row.max_continuous_duration or 0) if longest_row else 0
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


