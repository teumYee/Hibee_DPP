from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.schemas.log import AppUsageLogCreate, AppUsageLogResponse 

from app.core.database import get_db
from app.models.usage_log import UsageLog
from app.models.user import Users
from app.utils.category import get_category_name

router = APIRouter()

@router.post("", response_model=dict)
def upload_logs(
    log_data: AppUsageLogCreate,
    db: Session = Depends(get_db)
):
    # 프론트 구현 시, 로그인 유저의 실제 ID로 대체 필요
    current_user_id=1  # 임시로 사용자 ID를 1로 설정
    user = db.query(Users).filter(Users.id == current_user_id).first()

    # 유저가 없는 경우 예외 처리
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    added_count = 0
    # 이번 전송 묶음의 첫 번째 로그에만 unlock_count 정보가 담겨옴
    first_log_flag = True

    for log_item in log_data.logs:
        # 1. 중복 검사: 패키지명과 시작 시간이 모두 같은 데이터가 이미 있는지 확인
        # 밀리초 단위로 변환해서 비교
        start_ms = int(log_item.start_time.timestamp() * 1000)

        # 2. 야간 모드 판별 
        log_time_str = log_item.start_time.strftime("%H:%M")
        is_night_mode = False

        # 야간 종료 시간이 시작 시간보다 빠른 경우 (예: 디폴트로 23:00 ~ 07:00)
        def to_str(t):
            if isinstance(t, str):
                return t[:5]  # "23:00:00" -> "23:00"
            return t.strftime("%H:%M")

        n_start = to_str(user.night_mode_start)
        n_end = to_str(user.night_mode_end)

        # 야간 종료 시간이 시작 시간보다 빠른 경우 (날짜를 넘어가는 경우: 예 23:00 ~ 07:00)
        if n_start > n_end:
            if log_time_str >= n_start or log_time_str < n_end:
                is_night_mode = True    
        else:
            if n_start <= log_time_str < n_end:
                is_night_mode = True

        exists = db.query(UsageLog).filter(
            UsageLog.user_id == current_user_id,
            UsageLog.package_name == log_item.package_name,
            UsageLog.first_time_stamp == start_ms
        ).first()

        # 3. 중복이 아닌 경우에만 저장
        if not exists:

            raw_id = getattr(log_item, 'category_id', -1)
            cat_name = get_category_name(raw_id)
            
            new_log = UsageLog(
                user_id=current_user_id,
                package_name=log_item.package_name,
                app_name=log_item.app_name,
                usage_duration=log_item.usage_duration,
                first_time_stamp=start_ms,
                last_time_stamp=int(log_item.end_time.timestamp() * 1000) if log_item.end_time else start_ms,
                unlock_count=log_item.unlock_count,
                category_id=getattr(log_item, 'category_id', -1),
                category_name=cat_name,

                app_launch_count=log_item.app_launch_count,
                max_continuous_duration=log_item.max_continuous_duration,
                is_night_mode=is_night_mode,
            )
            db.add(new_log)
            added_count += 1
            first_log_flag = False # 이후 로그들은 0으로 기록

    db.commit()
    return {"message": f"기록 저장 성공"}

# 로그 조회 API (날짜 조건 추가)
# @router.get("/{user_id}", response_model=List[schemas.AppUsageLogResponse])
# def get_logs(user_id: int, date: datetime = None, db: Session = Depends(get_db)):
#     today = datetime.now().date()

#     if date is None:
#         date = datetime.now().date()
        
#     logs = db.query(UsageLog).filter(
#         UsageLog.user_id == user_id,
#         func.date(UsageLog.date) == today
#         ).order_by(UsageLog.first_time_stamp.asc()).all()
    

#     if not logs:
#         raise HTTPException(status_code=404, detail="해당 조건의 로그 기록이 없습니다.")
#     return logs
@router.get("/{user_id}", response_model=List[AppUsageLogResponse])
def get_logs(user_id: int, db: Session = Depends(get_db)):
    logs = db.query(UsageLog).filter(UsageLog.user_id == user_id).all()
    
    if not logs:
        raise HTTPException(status_code=404, detail="해당 조건의 로그 기록이 없습니다.")
        
    return logs