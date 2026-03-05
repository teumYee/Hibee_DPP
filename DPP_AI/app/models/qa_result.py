"""
qa_results 테이블 — 체크인 파이프라인 단계별 결과 로깅
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.sql import func

from app.core.database import Base

if Base is not None:

    class QAResult(Base):
        __tablename__ = "qa_results"

        id = Column(Integer, primary_key=True, index=True)
        run_id = Column(String(64), nullable=False, index=True)
        step = Column(String(32), nullable=False)  # writer | deterministic_check | llm_judge
        status = Column(String(16), nullable=False)  # ok | fail | error
        error_message = Column(Text, nullable=True)
        input_snapshot = Column(JSON, nullable=True)  # 요약 또는 전체 입력
        output_snapshot = Column(JSON, nullable=True)  # 요약 또는 전체 출력
        created_at = Column(DateTime(timezone=True), server_default=func.now())

else:
    QAResult = None  # DB 미사용 시
