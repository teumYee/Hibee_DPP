from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.core.database import get_db
from app.models.user import Users, UserConfigs
from app.models.calendar import CheckIn
from app.schemas.users import NicknameRequest, OnboardingRequest

router = APIRouter()


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
    user = db.query(Users).filter(Users.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    row = db.query(UserConfigs).filter(UserConfigs.user_id == body.user_id).first()
    if row is None:
        row = UserConfigs(user_id=body.user_id)
        db.add(row)

    row.goals = body.goals
    row.active_times = body.active_times
    row.night_mode_start = body.night_mode_start
    row.night_mode_end = body.night_mode_end
    row.struggles = body.struggles
    row.focus_categories = body.focus_categories
    row.checkin_time = None

    db.commit()
    db.refresh(row)

    return {"message": "온보딩 저장 완료"}


@router.get("/me/summary")
def get_me_summary(user_id: int, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # coin은 users 테이블 기준
    coin = int(user.coin or 0)

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
