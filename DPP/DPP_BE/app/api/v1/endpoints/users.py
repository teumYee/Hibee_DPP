from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Users, User_Stats, User_Configs
from app.schemas.onboarding import OnboardingRequest

router = APIRouter(prefix="/api/v1/users", tags=["users"])

@router.post("/onboarding")
async def complete_onboarding(
    data: OnboardingRequest,
    db : Session = Depends(get_db),
    current_user_id: int=1 # 임시

):
    existing_nickname = db.query(Users).filter(
        Users.nickname == data.nickname, 
        Users.id != current_user_id
    ).first()

    if existing_nickname:
        raise HTTPException(
            status_code=400, 
            detail="이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요."
        )

    user = db.query(Users).filter(Users.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.nickname = data.nickname

    config = db.query(User_Configs).filter(User_Configs.user_id == current_user_id).first()
    if not config:
        config = User_Configs(user_id=current_user_id)
        db.add(config)
    
    config.goals = data.goals
    config.active_times = data.active_times
    config.struggles = data.struggles
    config.night_mode_start = data.night_mode_start
    config.night_mode_end = data.night_mode_end

    stats = db.query(User_Stats).filter(User_Stats.user_id==current_user_id).first()
    if not stats:
        stats = User_Stats(
            user_id=current_user_id,
            coin=0,
            total_checkin_count=0,
            continuous_days=0
        )
        db.add(stats)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Data Integrity error: {str(e)}")
    
    return {"message": "온보딩 생성 완료!"}             