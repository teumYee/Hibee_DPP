from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.jwt_tokens import create_access_token
from app.models.user import Users
from google.oauth2 import id_token
from google.auth.transport import requests
import os

router = APIRouter()

# 구글 클라이언트 ID (콘솔에서 발급받은 것)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_WEB_CLIENT_ID")

@router.post("/google-login")
def google_login(token_data: dict, db: Session = Depends(get_db)):
    token = token_data.get("idToken")
    
    try:
        # 1. 구글 토큰 검증
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        nickname = idinfo.get('name', 'User')
        profile_image = idinfo.get('picture')

        # 2. DB에서 해당 이메일의 유저가 있는지 확인
        user = db.query(Users).filter(Users.email == email).first()

        # 3. 없으면 새로운 유저 생성 (회원가입)
        if not user:
            user = Users(
                email=email,
                nickname=nickname,
                profile_image=profile_image,
                coin=0,
                current_xp=0
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 4. 유저 정보 + 앱 API용 JWT (Authorization Bearer — Google ID 토큰 대신 장기 사용)
        access_token = create_access_token(user.id, user.email or "")
        return {
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "message": "로그인 성공",
            "access_token": access_token,
            "token_type": "bearer",
        }

    except ValueError as e:
        print(f"토큰 검증 실패: {e}")
        raise HTTPException(status_code=400, detail="유효하지 않은 구글 토큰입니다.")