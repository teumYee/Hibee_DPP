# 스마트폰 사용 db
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, BigInteger, BOOLEAN, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base

class UsageLog(Base):
    __tablename__ = "usage_logs"
    id= Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"),nullable=False)

    package_name = Column(String, nullable=True)
    app_name = Column(String, nullable=True)
    
    # 데이터가 들어가는 순간의 db의 시간이 기록됨.
    date = Column(DateTime(timezone=True), server_default=func.now())
    usage_duration = Column(Integer, nullable=True)
    category_id = Column(Integer, nullable=True)
    category_name = Column(String, default="Uncategorized")
    first_time_stamp = Column(BigInteger, nullable=True)
    last_time_stamp = Column(BigInteger, nullable=True)
    unlock_count = Column(Integer, default=0)

    # log.user.nickname 으로 사용자 닉네임 조회 가능
    user=relationship("Users", back_populates="usage_logs")

    is_night_mode = Column(BOOLEAN, default=False)  

    daily_goal_minutes = Column(Integer, default=0)

    # 고도화 지표 
    # 방문 횟수
    app_launch_count = Column(Integer, default=0)
    # 최장 연속 사용 (초)
    max_continuous_duration = Column(Integer, default=0)


class Daily_SnapShots(Base):
    __tablename__ = "daily_snap_shots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    snapshot_date = Column(Date, nullable=True)
    timezone = Column(String(100), nullable=True)
    package_name = Column(String, nullable=True)
    total_usage_check = Column(Integer, default=0)
    unlock_count = Column(Integer, default=0)
    time_of_day_buckets_sec = Column(Integer, default=0)
    time_of_day_buckets_json = Column(JSONB, nullable=True)
    max_continuous_sec = Column(Integer, default=0)
    app_launch_count = Column(Integer, default=0)
    per_app_usage_json = Column(JSONB, nullable=True)
    per_category_usage_json = Column(JSONB, nullable=True)
    timeline_buckets_json = Column(JSONB, nullable=True)
    top_apps_json = Column(JSONB, nullable=True)
    schema_version = Column(String(20), nullable=True)
    source_hash = Column(String(255), nullable=True)

    user = relationship("Users", back_populates="daily_snap_shots")
