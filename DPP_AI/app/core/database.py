"""
DB 연결 뼈대. DATABASE_URL이 설정된 경우에만 엔진/세션 사용.
qa_results 로깅용 (선택 사항).
"""
import os
import logging

logger = logging.getLogger("dpp_ai")

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker, declarative_base
except ImportError:
    create_engine = None
    sessionmaker = None
    declarative_base = lambda: None
    Base = None
    engine = None
    SessionLocal = None
else:
    Base = declarative_base()
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
    if SQLALCHEMY_DATABASE_URL:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info("Database engine created (qa_results logging available)")
    else:
        engine = None
        SessionLocal = None
        logger.info("DATABASE_URL not set; qa_results will log to logger only")


def get_db():
    """FastAPI Depends용. DB가 없으면 yield None 후 종료."""
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
