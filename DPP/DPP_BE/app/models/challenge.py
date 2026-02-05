
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key = True, index = True)
    title = Column(String(100), nullable=False)
    description = Column(Text,nullable=True)

    # 측정 지표 
    challenge_type = Column(String(50),nullable=False)

    # 재사용 여부
    is_reusable = Column(Boolean,default=False)

    # 기본 목표값 
    default_target_value =Column(Integer,nullable=False) 
    
    # 기간 범위
    time_scope = Column(String(20),nullable=False)

    instances = relationship("ChallengeInstances", back_populates="challenge")

# 사용자별 챌린지 진행 기록
class ChallengeInstances(Base):
    __tablename__  = "challenge_instances"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"),nullable=False)
    challenge_id = Column(Integer, ForeignKey("challenges.id"))

    # 상태 : 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    status = Column(String(20),default="IN_PROGRESS")

    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    # 관계 정리
    user = relationship("Users", back_populates="challenge_instances")
    challenge = relationship("Challenge", back_populates="instances")

    # 조건, 진척도, 보상 - 하위 데이터 연결
    conditions = relationship("Condition", back_populates="instance")
    progress_logs = relationship("ProgressLogs", back_populates="instance")
    rewards = relationship("Rewards", back_populates="instance")

class Condition(Base):
    __tablename__ = "conditions"

    id = Column(Integer,primary_key=True,index=True)
    instance_id = Column(Integer,ForeignKey("challenge_instances.id"),nullable=False)
    default_target_value = Column(Integer,nullable=False)
    operator = Column(String(10),default=">=")

    # 관계 정리
    instance = relationship("ChallengeInstances", back_populates="conditions")

class ProgressLogs(Base):
    # 예약어 충돌 가능성 우려로 테이블 이름 수정함
    __tablename__ = "progress_logs"

    id = Column(Integer, primary_key=True, index=True)
    instance_id = Column(Integer, ForeignKey("challenge_instances.id"))

    title = Column(String(100),nullable=True)
    description = Column(Text, nullable=True)

    # 현재 달성률 또는 값
    progress_rate = Column(Float,default=0.0)

    # 관계 정리
    instance = relationship("ChallengeInstances", back_populates="progress_logs")


class Rewards(Base):
    __tablename__ = "rewards"
    
    id = Column(Integer, primary_key=True, index=True)
    instance_id = Column(Integer,ForeignKey("challenge_instances.id"))

    title = Column(String(100),nullable=False)

    description = Column(Text, nullable=True)

    challenge_xp = Column(Integer,default=0)

    # 관계 정리
    instance = relationship("ChallengeInstances", back_populates = "rewards")


