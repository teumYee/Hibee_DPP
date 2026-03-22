from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class DailyReports(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    content = Column(Text, nullable=True)
    total_time = Column(Integer, default=0)
    late_night_usage = Column(Integer, default=0)
    category_usage = Column(JSONB, nullable=True)

    user = relationship("Users", back_populates="daily_reports")


class WeeklyReports(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date_week = Column(String(100), nullable=False)
    ai_score = Column(Float, nullable=True)
    checkin_count = Column(Integer, default=0)
    analysis = Column(Text, nullable=True)
    main_activity_time = Column(Text, nullable=True)
    better_day = Column(String(100), nullable=True)
    try_area = Column(Text, nullable=True)
    ai_comment = Column(Text, nullable=True)

    user = relationship("Users", back_populates="weekly_reports")


class ExpertKnowledge(Base):
    __tablename__ = "expert_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)


class ReportDraft(Base):
    __tablename__ = "report_drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    content = Column(Text, nullable=True)
    total_time = Column(Integer, default=0)
    late_night_usage = Column(Integer, default=0)
    category_usage = Column(JSONB, nullable=True)

    user = relationship("Users", back_populates="report_drafts")
    evidence_traces = relationship(
        "ReportEvidenceTrace",
        back_populates="report_draft",
        cascade="all, delete-orphan",
    )
    review_logs = relationship(
        "ReportReviewLog",
        back_populates="report_draft",
        cascade="all, delete-orphan",
    )


class ReportEvidenceTrace(Base):
    __tablename__ = "report_evidence_trace"

    id = Column(Integer, primary_key=True, index=True)
    report_draft_id = Column(Integer, ForeignKey("report_drafts.id", ondelete="CASCADE"), nullable=False)
    date = Column(DateTime, nullable=False, server_default=func.now())
    search_queries = Column(JSONB, nullable=True)
    search_filters = Column(JSONB, nullable=True)
    must_include_concepts = Column(JSONB, nullable=True)
    retrieved_evidence = Column(JSONB, nullable=True)

    report_draft = relationship("ReportDraft", back_populates="evidence_traces")


class ReportReviewLog(Base):
    __tablename__ = "report_review_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_draft_id = Column(Integer, ForeignKey("report_drafts.id", ondelete="CASCADE"), nullable=False)
    verdict = Column(Boolean, nullable=False)
    issues = Column(JSONB, nullable=True)
    rewrite_brief = Column(JSONB, nullable=True)
    iteration_count = Column(Integer, default=0, nullable=False)

    user = relationship("Users", back_populates="report_review_logs")
    report_draft = relationship("ReportDraft", back_populates="review_logs")
