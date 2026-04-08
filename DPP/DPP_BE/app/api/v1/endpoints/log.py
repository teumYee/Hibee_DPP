from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict, List
from datetime import datetime, date, timedelta, timezone

from app.schemas.log import (
    AppUsageLogCreate,
    AppUsageLogResponse,
    DailySnapshotCreateV3,
    DailySnapshotResponse,
)

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usage_log import UsageLog, Daily_SnapShots
from app.models.user import User_Configs, Users
from app.utils.category import get_category_name
from app.utils.checkin_policy import (
    CANONICAL_PACKAGE_NAME,
    current_logical_date,
    policy_from_config,
    resolve_logical_date,
)

router = APIRouter()

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


def _normalize_time_of_day_buckets(raw_buckets: Dict[str, int]) -> Dict[str, int]:
    normalized = {bucket: 0 for bucket in CANONICAL_TIME_OF_DAY_BUCKETS}

    for raw_key, raw_value in raw_buckets.items():
        bucket_key = TIME_OF_DAY_BUCKET_ALIASES.get(str(raw_key).strip(), str(raw_key).strip())
        if bucket_key not in normalized:
            continue

        try:
            normalized[bucket_key] += int(raw_value or 0)
        except (TypeError, ValueError):
            continue

    return normalized


def _as_list_of_dicts(items: Any) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}

@router.post("", response_model=dict)
def upload_logs(
    log_data: AppUsageLogCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id
    user = current_user

    # 유저가 없는 경우 예외 처리
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    added_count = 0
    updated_count = 0

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

        raw_id = getattr(log_item, 'category_id', -1)
        cat_name = get_category_name(raw_id)
        incoming_last_ms = (
            int(log_item.end_time.timestamp() * 1000)
            if log_item.end_time
            else start_ms
        )
        incoming_usage_duration = int(log_item.usage_duration or 0)
        incoming_launch_count = int(log_item.app_launch_count or 0)
        incoming_max_continuous = int(log_item.max_continuous_duration or 0)

        # 3. 중복이 아닌 경우에만 저장
        if exists:
            exists.app_name = log_item.app_name or exists.app_name
            exists.usage_duration = max(int(exists.usage_duration or 0), incoming_usage_duration)
            exists.last_time_stamp = max(int(exists.last_time_stamp or 0), incoming_last_ms)
            exists.category_id = raw_id
            exists.category_name = cat_name
            exists.app_launch_count = max(int(exists.app_launch_count or 0), incoming_launch_count)
            exists.max_continuous_duration = max(
                int(exists.max_continuous_duration or 0),
                incoming_max_continuous,
            )
            exists.is_night_mode = bool(exists.is_night_mode or is_night_mode)
            updated_count += 1
        else:
            # 일일 언락은 log_data.unlock_count 한 값인데, 동기화마다 "첫 행"에 넣으면 행마다 33이 쌓여 SUM이 33→66→99로 불어남
            # → 새 행에는 항상 per-item 만 저장, 일일 합은 아래에서 오늘 구간 대표 1행만 갱신
            new_log = UsageLog(
                user_id=current_user_id,
                package_name=log_item.package_name,
                app_name=log_item.app_name,
                usage_duration=incoming_usage_duration,
                first_time_stamp=start_ms,
                last_time_stamp=incoming_last_ms,
                unlock_count=log_item.unlock_count,
                category_id=raw_id,
                category_name=cat_name,

                app_launch_count=incoming_launch_count,
                max_continuous_duration=incoming_max_continuous,
                is_night_mode=is_night_mode,
            )
            db.add(new_log)
            added_count += 1

    # 오늘(서버 기준 UsageLog.date) 로그 중 id가 가장 작은 행 하나에만 일일 언락 저장 — 동기화 N회여도 값은 덮어쓰기
    today_start = datetime.combine(date.today(), datetime.min.time())
    next_day_start = today_start + timedelta(days=1)
    anchor = (
        db.query(UsageLog)
        .filter(
            UsageLog.user_id == current_user_id,
            UsageLog.date >= today_start,
            UsageLog.date < next_day_start,
        )
        .order_by(UsageLog.id.asc())
        .first()
    )
    if anchor is not None and (log_data.unlock_count > 0 or added_count > 0 or updated_count > 0):
        anchor.unlock_count = log_data.unlock_count
        others = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == current_user_id,
                UsageLog.date >= today_start,
                UsageLog.date < next_day_start,
                UsageLog.id != anchor.id,
            )
            .all()
        )
        for row in others:
            row.unlock_count = 0

    db.commit()
    return {"message": "기록 저장 성공", "added": added_count, "updated": updated_count}

@router.post("/snapshots/v3", response_model=DailySnapshotResponse)
def create_daily_snapshot_v3(
    payload: DailySnapshotCreateV3,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    current_user_id = current_user.id
    user_config = db.query(User_Configs).filter(User_Configs.user_id == current_user_id).first()
    normalized_package_name = payload.package_name or CANONICAL_PACKAGE_NAME
    normalized_buckets = _normalize_time_of_day_buckets(payload.time_of_day_buckets_sec)
    bucket_total_sec = sum(normalized_buckets.values())
    policy = policy_from_config(user_config, timezone_name=payload.timezone)
    captured_at = payload.captured_at or datetime.now(timezone.utc)
    logical_date = resolve_logical_date(
        captured_at,
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )
    target_date = logical_date if normalized_package_name == CANONICAL_PACKAGE_NAME else payload.date

    # 1. 같은 날짜, 같은 유저, 같은 패키지의 기존 스냅샷 조회
    existing_snapshot = db.query(Daily_SnapShots).filter(
        Daily_SnapShots.user_id == current_user_id,
        Daily_SnapShots.package_name == normalized_package_name,
        Daily_SnapShots.snapshot_date == target_date,
    ).first()

    if existing_snapshot:
        # 2. 존재하면 업데이트 (Upsert)
        existing_snapshot.total_usage_check = payload.total_usage_check
        existing_snapshot.unlock_count = payload.unlock_count
        existing_snapshot.time_of_day_buckets_sec = bucket_total_sec
        existing_snapshot.time_of_day_buckets_json = normalized_buckets
        existing_snapshot.max_continuous_sec = payload.max_continuous_sec
        existing_snapshot.app_launch_count = payload.app_launch_count
        existing_snapshot.snapshot_date = target_date
        existing_snapshot.timezone = policy.timezone
        existing_snapshot.package_name = normalized_package_name
        existing_snapshot.per_app_usage_json = _as_list_of_dicts(payload.per_app_usage_json)
        existing_snapshot.per_category_usage_json = _as_list_of_dicts(payload.per_category_usage_json)
        existing_snapshot.timeline_buckets_json = _as_dict(payload.timeline_buckets_json)
        existing_snapshot.top_apps_json = _as_list_of_dicts(payload.top_apps_json)
        existing_snapshot.schema_version = payload.schema_version
        existing_snapshot.source_hash = payload.source_hash
        db.commit()
        db.refresh(existing_snapshot)
        snapshot = existing_snapshot
        upserted = True
    else:
        # 3. 없으면 새로 생성
        snapshot = Daily_SnapShots(
            user_id=current_user_id,
            snapshot_date=target_date,
            timezone=policy.timezone,
            package_name=normalized_package_name,
            total_usage_check=payload.total_usage_check,
            unlock_count=payload.unlock_count,
            time_of_day_buckets_sec=bucket_total_sec,
            time_of_day_buckets_json=normalized_buckets,
            max_continuous_sec=payload.max_continuous_sec,
            app_launch_count=payload.app_launch_count,
            per_app_usage_json=_as_list_of_dicts(payload.per_app_usage_json),
            per_category_usage_json=_as_list_of_dicts(payload.per_category_usage_json),
            timeline_buckets_json=_as_dict(payload.timeline_buckets_json),
            top_apps_json=_as_list_of_dicts(payload.top_apps_json),
            schema_version=payload.schema_version,
            source_hash=payload.source_hash,
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        upserted = False

    return {
        "snapshot_id": snapshot.id,
        "status": "success",
        "upserted": upserted,
        "snapshot_date": snapshot.snapshot_date or current_logical_date(
            user_config,
            timezone_name=policy.timezone,
        ),
    }
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

