from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func,desc,text
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional

from app import schemas
from app.core.database import get_db
from app.models.usage_log import UsageLog
from app.models.user import Users, User_App_Categories

router = APIRouter()


# 대시보드 요약 정보 API
@router.get("/dashboard/summary/{user_id}", response_model=dict)
def get_dashboard_summary(user_id: int, db: Session = Depends(get_db)):
    # today = datetime.now().date() 
    # test_date = date(2026, 1, 31) 
    # logs = db.query(UsageLog).filter(func.date(UsageLog.date) == test_date).all()
    today_start = datetime.combine(date.today(), datetime.min.time())
    next_day_start = today_start + timedelta(days=1)
    
    # 1) summary — 오늘 전체 사용시간/언락 합산
    stats = db.query(
        func.coalesce(func.sum(UsageLog.usage_duration), 0).label("total_time_seconds"),
        func.coalesce(func.sum(UsageLog.unlock_count), 0).label("total_unlocks"),
    ).filter(
        UsageLog.user_id == user_id,
        UsageLog.date >= today_start,
        UsageLog.date < next_day_start,
    ).first()

    total_time_seconds = int(stats.total_time_seconds) if stats else 0
    total_unlocks = int(stats.total_unlocks) if stats else 0

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
    if most_used:
        most_used_name = (
            most_used.app_name
            if most_used.app_name and most_used.app_name != "Unknown"
            else most_used.package_name
        )
        most_used_minutes = int(round(int(most_used.total_duration_seconds or 0) / 60))

    # 3) top_visited — app_launch_count 합산 기준 상위 3개
    top_visited_rows = db.query(
        UsageLog.package_name,
        UsageLog.app_name,
        func.coalesce(func.sum(UsageLog.app_launch_count), 0).label("launch_count"),
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
        }
        for row in (top_visited_rows or [])
    ]

    # 4) longest_session — max_continuous_duration 최대값
    longest_session_seconds = (
        db.query(func.coalesce(func.max(UsageLog.max_continuous_duration), 0))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.date >= today_start,
            UsageLog.date < next_day_start,
        )
        .scalar()
        or 0
    )

    return {
        "summary": {
            "total_time": int(round(total_time_seconds / 60)),
            "total_unlocks": total_unlocks,
            "longest_session": int(round(int(longest_session_seconds) / 60)),
        },
        "most_used_app": {"name": most_used_name, "minutes": most_used_minutes},
        "top_visited": top_visited,
    }


