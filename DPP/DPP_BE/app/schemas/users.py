from typing import Any

from pydantic import BaseModel, Field


class NicknameRequest(BaseModel):
    user_id: int
    nickname: str = Field(..., min_length=1)


class OnboardingRequest(BaseModel):
    user_id: int
    goals: list[Any] = Field(default_factory=list)
    active_times: list[Any] = Field(default_factory=list)
    night_mode_start: str
    night_mode_end: str
    struggles: list[Any] = Field(default_factory=list)
    focus_categories: list[Any] = Field(default_factory=list)
