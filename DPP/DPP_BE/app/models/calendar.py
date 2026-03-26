from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Text,
    Boolean,
    Date,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    Category = Column(String(50), default="Uncategorized", nullable=False)

    user = relationship("Users", back_populates="calendar_events")


class CheckIn(Base):
    """일일 체크인 (KPT + 선택 패턴)."""

    __tablename__ = "daily_checkins"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_checkins_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    selected_patterns = Column(JSONB, nullable=True)
    kpt_keep = Column(Text, nullable=True)
    kpt_problem = Column(Text, nullable=True)
    kpt_try = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False, nullable=False)

    user = relationship("Users", back_populates="daily_checkins")


class PatternCandidatesDaily(Base):
    __tablename__ = "pattern_candidates_daily"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_pattern_candidates_daily_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    selected_patterns = Column(JSONB, nullable=True)

    user = relationship("Users", back_populates="pattern_candidates_daily")
    review_logs = relationship(
        "PatternCandidatesLog",
        back_populates="candidate",
        cascade="all, delete-orphan",
    )


class PatternCandidatesLog(Base):
    __tablename__ = "pattern_candidates_logs"

    id = Column(Integer, primary_key=True, index=True)
    pattern_candidate_daily_id = Column(
        Integer, ForeignKey("pattern_candidates_daily.id", ondelete="SET NULL"), nullable=True
    )
    verdict = Column(String(100), nullable=True)
    violations = Column(JSONB, nullable=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())

    candidate = relationship("PatternCandidatesDaily", back_populates="review_logs")
