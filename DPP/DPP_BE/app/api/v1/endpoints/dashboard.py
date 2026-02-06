from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func,desc,text
from sqlalchemy.orm import Session
from datetime import datetime, date
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
    test_date = datetime.now().date()
    # logs = db.query(UsageLog).filter(func.date(UsageLog.date) == test_date).all()
    
    # 1. 상단 카드 지표 (총 시간, 총 언락)
    stats = db.query(
        func.sum(UsageLog.usage_duration).label("total_time"),
        func.max(UsageLog.unlock_count).label("total_unlocks")
    ).filter(
        UsageLog.user_id == user_id, 
        func.date(UsageLog.date)==test_date).first()

    # 2. 가장 자주 들른 곳 & 상위 3개 앱
    #  app_launch_count 필드를 합산하여 순위를 매김.
    app_ranks = db.query(
        UsageLog.package_name,
        UsageLog.app_name, # 앱 이름도 같이 가져오기
        func.sum(UsageLog.app_launch_count).label("launch_count"),
        func.sum(UsageLog.usage_duration).label("total_duration")
    ).filter(UsageLog.user_id == user_id, func.date(UsageLog.date)== test_date)\
     .group_by(UsageLog.package_name, UsageLog.app_name)\
     .order_by(
     desc(text("launch_count")),    
     desc(text("total_duration"))  # 실행횟수가 같다면, 사용시간 기준도 비교
 ).limit(4).all()

    # 3. 가장 긴 연속 사용 시간
    max_session = db.query(func.max(UsageLog.max_continuous_duration))\
        .filter(UsageLog.user_id == user_id, func.date(UsageLog.date)==test_date).scalar() or 0
    
    # 총 사용 시간, 언락
    total_time_hour=(stats.total_time /3600) if stats and stats.total_time else 0
    total_unlocks = stats.total_unlocks if stats and stats.total_unlocks else 0

    return {
        "summary": {
            "total_time": round(total_time_hour,1), # 소수점 정리
            "total_unlocks": total_unlocks,
            "longest_session": round(max_session / 3600, 1)
        },
        "top_visited": {
            "main": {
                "name": app_ranks[0].app_name if app_ranks else "데이터 없음",
                "count": int(app_ranks[0].launch_count) if app_ranks else 0
            },
            "others": [
                {"name": row.app_name, "count": int(row.launch_count)} for row in app_ranks[1:4]
            ]
        }
    }


