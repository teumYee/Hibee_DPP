from typing import List

from pydantic import BaseModel, Field


class CheckinPatternEvidenceDTO(BaseModel):
    metrics_used: List[str] = Field(default_factory=list)
    numbers: List[float] = Field(default_factory=list)


class CheckinPatternItemDTO(BaseModel):
    candidate_id: str
    label: str = ""
    observation: str = ""
    interpretation: str = ""
    evidence: CheckinPatternEvidenceDTO = Field(default_factory=CheckinPatternEvidenceDTO)
    tags: List[str] = Field(default_factory=list)


class CheckinPatternsResponseDTO(BaseModel):
    patterns: List[CheckinPatternItemDTO] = Field(default_factory=list)


class NightStatsResponseDTO(BaseModel):
    night_usage_seconds: int = 0


class CheckinAppSubmitBody(BaseModel):
    """모바일 체크인 제출 — pattern_ids는 최대 3개 슬롯, kpt_tags는 비어 있지 않은 슬롯과 1:1 대응."""

    pattern_ids: tuple[str, str, str]
    kpt_tags: List[str] = Field(default_factory=list)
