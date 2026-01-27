import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger("dpp_ai")
logging.basicConfig(level=logging.INFO)

# .env 로드
try:
    from dotenv import load_dotenv  # pip3 install python-dotenv
    load_dotenv()
    logger.info("✅ .env loaded")
except Exception as e:
    logger.warning(f"⚠️ python-dotenv not loaded: {e}")

def require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name}가 환경변수(.env 포함)에 없습니다. AI 서버 실행 불가!")
    return v

def create_app() -> FastAPI:
    # 키가 없으면 서버 자체가 뜨면 안 됨
    require_env("OPENAI_API_KEY")
    require_env("AI_TEST_ROOT")

    app = FastAPI(title="DPP AI Server", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "openai_key_loaded": True,
            "ai_test_root_loaded": True,
        }

    from app.routers.checkin_question import router as checkin_question_router
    app.include_router(checkin_question_router)

    return app

app = create_app()
