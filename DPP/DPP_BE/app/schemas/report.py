from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CandidateEvidence(BaseModel):
    unlock_count: Optional[int] = None
    total_usage_check: Optional[int] = None
    max_continuous_sec: Optional[int] = None
    app_launch_count: Optional[int] = None
    metrics_used: List[str] = Field(default_factory=list)
    numbers: List[int | float] = Field(default_factory=list)


class PatternCandidate(BaseModel):
    candidate_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    label: Optional[str] = None
    observation: Optional[str] = None
    interpretation: Optional[str] = None
    evidence: CandidateEvidence
    tags: List[str] = Field(default_factory=list)


class PatternCandidatesGenerateRequest(BaseModel):
    date: date
    force_regenerate: bool = False


class PatternCandidatesResponse(BaseModel):
    date: str
    status: str
    generated: bool
    candidates: List[PatternCandidate]


class CheckinSaveRequest(BaseModel):
    date: date
    selected_patterns: List[PatternCandidate]
    kpt_keep: Optional[str] = None
    kpt_problem: Optional[str] = None
    kpt_try: Optional[str] = None
    is_completed: bool = True


class CheckinResponse(BaseModel):
    checkin_id: int
    date: str
    selected_patterns: List[PatternCandidate]
    kpt_keep: Optional[str] = None
    kpt_problem: Optional[str] = None
    kpt_try: Optional[str] = None
    is_completed: bool


class DailyReportGenerateRequest(BaseModel):
    date: date
    force_regenerate: bool = False


class DailyChartData(BaseModel):
    total_usage_check: int = 0
    unlock_count: int = 0
    max_continuous_sec: int = 0
    app_launch_count: int = 0
    time_of_day_buckets: Dict[str, int] = Field(default_factory=dict)


class DailyReportResponse(BaseModel):
    date: str
    status: str
    report_markdown: Optional[str] = Field(default=None, description="deprecated")
    report_text: Optional[str] = None
    summary: Optional[str] = None
    highlights: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    chart_data: DailyChartData = Field(default_factory=DailyChartData)
    evidence_refs: List[str] = Field(default_factory=list)
    issues: List[str] = Field(default_factory=list)


class WeeklyReportGenerateRequest(BaseModel):
    week_start: date
    force_regenerate: bool = False


class WeeklyChartData(BaseModel):
    ai_score: float = 0
    checkin_count: int = 0
    total_usage_check: int = 0
    avg_daily_usage: int = 0
    avg_daily_unlock_count: int = 0
    total_app_launch_count: int = 0
    max_continuous_sec: int = 0
    time_of_day_buckets: Dict[str, int] = Field(default_factory=dict)
    daily_usage: Dict[str, int] = Field(default_factory=dict)


class WeeklyReportResponse(BaseModel):
    week_start: str
    status: str
    report_markdown: Optional[str] = Field(default=None, description="deprecated")
    report_text: Optional[str] = None
    summary: Optional[str] = None
    insights: List[str] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)
    chart_data: WeeklyChartData = Field(default_factory=WeeklyChartData)
    evidence_refs: List[str] = Field(default_factory=list)
    issues: List[str] = Field(default_factory=list)


class DailyReviewResponse(BaseModel):
    date: str
    draft_id: int
    status: str
    iteration_count: int = 0
    report_markdown: Optional[str] = None
    issues: List[str] = Field(default_factory=list)
    rewrite_brief: Any = None
    search_queries: List[str] = Field(default_factory=list)
    search_filters: Dict[str, Any] = Field(default_factory=dict)
    must_include_concepts: List[str] = Field(default_factory=list)
    retrieved_evidence: List[Dict[str, Any]] = Field(default_factory=list)