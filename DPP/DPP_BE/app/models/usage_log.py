# 스마트폰 사용 db
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger, BOOLEAN
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
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
    max_continuous_duration = Column(Integer,default=0)
