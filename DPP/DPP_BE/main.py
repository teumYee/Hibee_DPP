from dotenv import load_dotenv
load_dotenv()
from app.api.v1.endpoints.log import router as log_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.users import router as onboarding_router
from app.api.v1.endpoints.report import router as report_router
from app.api.v1.endpoints.calendar import router as calendar_router
from app.api.v1.endpoints.gamification import router as gamification_router
from app.api.v1.endpoints.challenges import router as challenges_router
from app.api.v1.endpoints.social import router as social_router

from pydoc import describe
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app import models, schemas
from sqlalchemy.orm import Session
from app.models.usage_log import UsageLog
from app.models.user import Users
from sqlalchemy.orm import Session

# from fastapi.responses import JSONResponse
# import traceback

# 가상환경 설정 및 패키지 설치
# python -m venv venv
# .\venv\Scripts\activate
# pip install -r requirements.txt

# uvicorn main:app --reload : 로컬 테스트용
#  uvicorn main:app --host 0.0.0.0 --port 8000 --reload : 외부 접속 허용

# uvicorn app.main:app --reload
# 스키마는 Alembic으로 관리 (alembic upgrade head)

app=FastAPI(
    title="DPP API",
    description = "돌핀팟",
    version="1.0.0"
)

origins = ["*"]

# CORS 설정 (안하면 오류남)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(log_router, prefix="/api/v1/logs",tags=["logs"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(dashboard_router,prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(onboarding_router,prefix="/api/v1/users", tags=["onboarding"])
app.include_router(report_router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(calendar_router, prefix="/api/v1/calendar", tags=["calendar"])
app.include_router(gamification_router, prefix="/api/v1/gamification", tags=["gamification"])
app.include_router(challenges_router, prefix="/api/v1/challenges", tags=["challenges"])
app.include_router(social_router, prefix="/api/v1/social", tags=["social"])


@app.get("/")
def dolphin_pod_check():
    return {
        "status" : "ok",
        "message" : " 🐬 돌고래들이 헤엄치고 있어요 "
    }


# API 엔드포인트 추가 예정

# from api.v1.endpoints import users, usage_logs
# app.include_router(users.router, prefix="/api/v1/users",tags=["users"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
