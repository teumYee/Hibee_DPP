from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import Users, UserConfigs
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
