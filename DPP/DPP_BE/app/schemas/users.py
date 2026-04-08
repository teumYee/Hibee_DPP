from pydantic import BaseModel, Field


class NicknameRequest(BaseModel):
    user_id: int
    nickname: str = Field(..., min_length=1)


class OnboardingRequest(BaseModel):
    user_id: int
    goals: list[str] = Field(default_factory=list)
    active_times: list[str] = Field(default_factory=list)
    night_mode_start: str
    night_mode_end: str
    checkin_time: str = "21:00"
    checkin_window_minutes: int = 120
    day_rollover_time: str = "21:00"
    struggles: list[str] = Field(default_factory=list)
    focus_categories: list[str] = Field(default_factory=list)


class WeeklyGoalUpdateRequest(BaseModel):
    goals: list[str] = Field(default_factory=list)


class NightModeUpdateRequest(BaseModel):
    night_mode_start: str = Field(..., min_length=4, max_length=5)
    night_mode_end: str = Field(..., min_length=4, max_length=5)


class ActiveTimeUpdateRequest(BaseModel):
    active_time: str = Field(..., min_length=1)


class CheckinTimeUpdateRequest(BaseModel):
    checkin_time: str = Field(..., min_length=4, max_length=5)
