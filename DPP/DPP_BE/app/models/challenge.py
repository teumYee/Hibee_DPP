
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
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


class StrollGroups(Base):
    __tablename__ = "stroll_groups"
    __table_args__ = (
        UniqueConstraint("group_code", name="uq_stroll_groups_group_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=True)
    group_code = Column(String(12), nullable=False, index=True)
    join_mode = Column(String(20), nullable=False, default="CODE")
    status = Column(String(20), nullable=False, default="ACTIVE")
    week_start_date = Column(Date, nullable=False, index=True)
    week_end_date = Column(Date, nullable=False, index=True)
    max_members = Column(Integer, nullable=False, default=5)
    target_checkin_count = Column(Integer, nullable=False)
    current_checkin_count = Column(Integer, nullable=False, default=0)
    reward_coin = Column(Integer, nullable=False, default=30)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dolphin_name = Column(String(50), nullable=True)
    ending_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    challenge_started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    creator = relationship(
        "Users",
        foreign_keys=[created_by_user_id],
        back_populates="stroll_groups_created",
    )
    members = relationship("StrollGroupMembers", back_populates="group")
    contributions = relationship("StrollGroupCheckinContributions", back_populates="group")


class StrollGroupMembers(Base):
    __tablename__ = "stroll_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_stroll_group_members_group_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("stroll_groups.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    member_status = Column(String(20), nullable=False, default="ACTIVE")
    join_source = Column(String(20), nullable=False, default="CODE")
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    left_at = Column(DateTime(timezone=True), nullable=True)
    contribution_count = Column(Integer, nullable=False, default=0)
    reward_claimed_at = Column(DateTime(timezone=True), nullable=True)

    group = relationship("StrollGroups", back_populates="members")
    user = relationship("Users", back_populates="stroll_group_memberships")
    contributions = relationship("StrollGroupCheckinContributions", back_populates="member")


class StrollGroupCheckinContributions(Base):
    __tablename__ = "stroll_group_checkin_contributions"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", "checkin_date", name="uq_stroll_group_contribution_daily"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("stroll_groups.id"), nullable=False, index=True)
    group_member_id = Column(Integer, ForeignKey("stroll_group_members.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    checkin_id = Column(Integer, ForeignKey("daily_checkins.id", ondelete="SET NULL"), nullable=True)
    checkin_date = Column(Date, nullable=False, index=True)
    counted_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("StrollGroups", back_populates="contributions")
    member = relationship("StrollGroupMembers", back_populates="contributions")
    user = relationship("Users")


