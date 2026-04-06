from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.calendar import CheckIn, PatternCandidatesDaily, PatternCandidatesLog
from app.models.challenge import ChallengeInstances, Condition, ProgressLogs, Rewards
from app.models.gamification import UserAchievements, UserCharacters, UserItems
from app.models.recommendactions import Recommendactions, UserFeedback
from app.models.reports import (
    DailyReports,
    ReportDraft,
    ReportEvidenceTrace,
    ReportReviewLog,
    WeeklyReports,
)
from app.models.social import Alerts, Friendships
from app.models.usage_log import Daily_SnapShots, UsageLog
from app.models.user import User_App_Categories, User_Configs, User_Stats, Users
from app.schemas.users import (
    ActiveTimeUpdateRequest,
    CheckinTimeUpdateRequest,
    NicknameRequest,
    NightModeUpdateRequest,
    OnboardingRequest,
    WeeklyGoalUpdateRequest,
)
from app.utils.checkin_policy import (
    DEFAULT_CHECKIN_TIME,
    DEFAULT_CHECKIN_WINDOW_MINUTES,
    DEFAULT_DAY_ROLLOVER_TIME,
    normalize_hhmm,
    normalize_window_minutes,
)

router = APIRouter()


def _get_or_create_user_config(db: Session, user_id: int) -> User_Configs:
    config = db.query(User_Configs).filter(User_Configs.user_id == user_id).first()
    if config:
        if not config.checkin_time:
            config.checkin_time = DEFAULT_CHECKIN_TIME
        if not config.checkin_window_minutes:
            config.checkin_window_minutes = DEFAULT_CHECKIN_WINDOW_MINUTES
        if not config.day_rollover_time:
            config.day_rollover_time = DEFAULT_DAY_ROLLOVER_TIME
        return config

    config = User_Configs(
        user_id=user_id,
        checkin_time=DEFAULT_CHECKIN_TIME,
        checkin_window_minutes=DEFAULT_CHECKIN_WINDOW_MINUTES,
        day_rollover_time=DEFAULT_DAY_ROLLOVER_TIME,
    )
    db.add(config)
    db.flush()
    return config


def _get_or_create_user_stats(db: Session, user_id: int) -> User_Stats:
    stats = db.query(User_Stats).filter(User_Stats.user_id == user_id).first()
    if stats:
        if stats.coin is None:
            legacy_coin = db.query(Users.coin).filter(Users.id == user_id).scalar()
            stats.coin = int(legacy_coin or 0)
            db.flush()
        return stats

    legacy_coin = db.query(Users.coin).filter(Users.id == user_id).scalar()
    stats = User_Stats(
        user_id=user_id,
        coin=int(legacy_coin or 0),
        total_checkin_count=0,
        continuous_days=0,
        friend_count=0,
        cheer_count=0,
    )
    db.add(stats)
    db.flush()
    return stats


def _validate_hhmm(value: str, field_name: str) -> str:
    time_text = value.strip()
    parts = time_text.split(":")
    if len(parts) != 2 or not all(part.isdigit() for part in parts):
        raise HTTPException(status_code=400, detail=f"{field_name} 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요.")

    hour, minute = (int(part) for part in parts)
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise HTTPException(status_code=400, detail=f"{field_name} 값이 올바르지 않습니다.")

    return f"{hour:02d}:{minute:02d}"


@router.post("/nickname")
def save_nickname(body: NicknameRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    user.nickname = body.nickname.strip()
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="이미 사용 중인 닉네임입니다.",
        )

    return {"message": "닉네임 저장 완료"}


@router.post("/onboarding")
def save_onboarding(body: OnboardingRequest, db: Session = Depends(get_db)):
    current_user_id = body.user_id
    user = db.query(Users).filter(Users.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    config = _get_or_create_user_config(db, current_user_id)

    config.goals = body.goals
    config.active_times = body.active_times
    config.struggles = body.struggles
    config.focus_categories = body.focus_categories
    config.night_mode_start = _validate_hhmm(body.night_mode_start, "night_mode_start")
    config.night_mode_end = _validate_hhmm(body.night_mode_end, "night_mode_end")
    config.checkin_time = _validate_hhmm(body.checkin_time, "checkin_time")
    config.checkin_window_minutes = normalize_window_minutes(body.checkin_window_minutes)
    config.day_rollover_time = _validate_hhmm(body.day_rollover_time, "day_rollover_time")

    user.night_mode_start = config.night_mode_start
    user.night_mode_end = config.night_mode_end

    _get_or_create_user_stats(db, current_user_id)

    db.commit()

    return {"message": "온보딩 저장 완료"}


@router.patch("/settings/weekly-goal")
def update_weekly_goal(
    body: WeeklyGoalUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    config = _get_or_create_user_config(db, current_user.id)
    config.goals = body.goals
    db.commit()

    return {
        "message": "주간 목표 재설정 완료",
        "goals": body.goals,
    }


@router.patch("/settings/night-mode")
def update_night_mode(
    body: NightModeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    night_mode_start = _validate_hhmm(body.night_mode_start, "night_mode_start")
    night_mode_end = _validate_hhmm(body.night_mode_end, "night_mode_end")

    config = _get_or_create_user_config(db, current_user.id)
    config.night_mode_start = night_mode_start
    config.night_mode_end = night_mode_end

    current_user.night_mode_start = night_mode_start
    current_user.night_mode_end = night_mode_end
    db.commit()

    return {
        "message": "심야 시간 재설정 완료",
        "night_mode_start": night_mode_start,
        "night_mode_end": night_mode_end,
    }


@router.patch("/settings/active-time")
def update_active_time(
    body: ActiveTimeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    active_time = body.active_time.strip()
    if not active_time:
        raise HTTPException(status_code=400, detail="active_time 값이 비어 있습니다.")

    config = _get_or_create_user_config(db, current_user.id)
    config.active_times = [active_time]
    db.commit()

    return {
        "message": "주요 활동 시간 재설정 완료",
        "active_times": [active_time],
    }


@router.patch("/settings/checkin-time")
def update_checkin_time(
    body: CheckinTimeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    checkin_time = normalize_hhmm(body.checkin_time, DEFAULT_CHECKIN_TIME)
    if checkin_time != body.checkin_time.strip():
        checkin_time = _validate_hhmm(body.checkin_time, "checkin_time")
    config = _get_or_create_user_config(db, current_user.id)
    config.checkin_time = checkin_time
    db.commit()

    return {
        "message": "체크인 시간 재설정 완료",
        "checkin_time": checkin_time,
    }


@router.delete("/me/data")
def delete_my_app_data(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_id = current_user.id

    # 하위 레코드부터 삭제해 외래키 충돌을 피한다.
    draft_ids = [
        draft_id
        for (draft_id,) in db.query(ReportDraft.id).filter(ReportDraft.user_id == user_id).all()
    ]
    instance_ids = [
        instance_id
        for (instance_id,) in db.query(ChallengeInstances.id).filter(ChallengeInstances.user_id == user_id).all()
    ]
    recommendation_ids = [
        recommendation_id
        for (recommendation_id,) in db.query(Recommendactions.id).filter(Recommendactions.user_id == user_id).all()
    ]
    pattern_candidate_ids = [
        candidate_id
        for (candidate_id,) in db.query(PatternCandidatesDaily.id).filter(PatternCandidatesDaily.user_id == user_id).all()
    ]

    if draft_ids:
        db.query(ReportEvidenceTrace).filter(ReportEvidenceTrace.report_draft_id.in_(draft_ids)).delete(
            synchronize_session=False
        )
        db.query(ReportReviewLog).filter(
            or_(
                ReportReviewLog.report_draft_id.in_(draft_ids),
                ReportReviewLog.user_id == user_id,
            )
        ).delete(synchronize_session=False)
        db.query(ReportDraft).filter(ReportDraft.id.in_(draft_ids)).delete(synchronize_session=False)

    if instance_ids:
        db.query(Condition).filter(Condition.instance_id.in_(instance_ids)).delete(synchronize_session=False)
        db.query(ProgressLogs).filter(ProgressLogs.instance_id.in_(instance_ids)).delete(synchronize_session=False)
        db.query(Rewards).filter(Rewards.instance_id.in_(instance_ids)).delete(synchronize_session=False)
        db.query(ChallengeInstances).filter(ChallengeInstances.id.in_(instance_ids)).delete(
            synchronize_session=False
        )

    if recommendation_ids:
        db.query(UserFeedback).filter(UserFeedback.recommendation_id.in_(recommendation_ids)).delete(
            synchronize_session=False
        )
        db.query(Recommendactions).filter(Recommendactions.id.in_(recommendation_ids)).delete(
            synchronize_session=False
        )

    if pattern_candidate_ids:
        db.query(PatternCandidatesLog).filter(
            PatternCandidatesLog.pattern_candidate_daily_id.in_(pattern_candidate_ids)
        ).delete(synchronize_session=False)
        db.query(PatternCandidatesDaily).filter(PatternCandidatesDaily.id.in_(pattern_candidate_ids)).delete(
            synchronize_session=False
        )

    db.query(UserItems).filter(UserItems.user_id == user_id).delete(synchronize_session=False)
    db.query(UserCharacters).filter(UserCharacters.user_id == user_id).delete(synchronize_session=False)
    db.query(UserAchievements).filter(UserAchievements.user_id == user_id).delete(synchronize_session=False)
    db.query(WeeklyReports).filter(WeeklyReports.user_id == user_id).delete(synchronize_session=False)
    db.query(DailyReports).filter(DailyReports.user_id == user_id).delete(synchronize_session=False)
    db.query(CheckIn).filter(CheckIn.user_id == user_id).delete(synchronize_session=False)
    db.query(Daily_SnapShots).filter(Daily_SnapShots.user_id == user_id).delete(synchronize_session=False)
    db.query(UsageLog).filter(UsageLog.user_id == user_id).delete(synchronize_session=False)
    db.query(Alerts).filter(
        or_(
            Alerts.receiver_id == user_id,
            Alerts.sender_id == user_id,
        )
    ).delete(synchronize_session=False)
    db.query(Friendships).filter(
        or_(
            Friendships.requester_id == user_id,
            Friendships.receiver_id == user_id,
        )
    ).delete(synchronize_session=False)
    db.query(User_App_Categories).filter(User_App_Categories.user_id == user_id).delete(
        synchronize_session=False
    )

    config = _get_or_create_user_config(db, user_id)
    config.goals = []
    config.active_times = []
    config.struggles = []
    config.focus_categories = []
    config.night_mode_start = "23:00"
    config.night_mode_end = "07:00"
    config.checkin_time = "21:00"

    stats = _get_or_create_user_stats(db, user_id)
    stats.current_title_id = None
    stats.equipped_character = None
    stats.social_representative_character_id = None
    stats.total_checkin_count = 0
    stats.last_chekin_date = None
    stats.last_login_date = None
    stats.coin = 0
    stats.continuous_days = 0
    stats.friend_count = 0
    stats.cheer_count = 0

    current_user.nickname = None
    current_user.target_time = None
    current_user.current_xp = 0
    current_user.equipped_character = None
    # 레거시 컬럼은 제거 전까지 초기화만 유지한다.
    current_user.coin = 0
    current_user.night_mode_start = "23:00"
    current_user.night_mode_end = "07:00"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="앱 데이터 초기화 중 오류가 발생했습니다.")

    return {
        "message": "앱 데이터가 초기화되었습니다.",
        "reset": {
            "user_id": user_id,
            "nickname_cleared": True,
            "reports_deleted": True,
            "checkins_deleted": True,
            "onboarding_cleared": True,
        },
    }


@router.get("/me/summary")
def get_me_summary(user_id: int, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    stats = _get_or_create_user_stats(db, user_id)
    coin = int(stats.coin or 0)

    # streak_days: daily_checkins 테이블에서 오늘부터 연속으로 존재하는 날짜 수 계산
    # (user_stats 테이블이 현재 모델에 없어서 daily_checkins 기반으로 계산)
    today = date.today()
    dates = db.query(CheckIn.date).filter(CheckIn.user_id == user_id).all()
    date_set = {row[0] for row in dates if row and row[0] is not None}

    streak = 0
    cursor = today
    while cursor in date_set:
        streak += 1
        cursor = cursor - timedelta(days=1)

    return {
        "nickname": user.nickname,
        "coin": coin,
        "streak_days": streak,
    }
