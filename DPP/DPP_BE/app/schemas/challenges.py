from datetime import date, datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


class CommonCheckinGroupCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)
    target_checkin_count: int = Field(..., ge=1, le=500)
    max_members: int = Field(default=5, ge=2, le=10)
    join_mode: Literal["CODE", "FRIEND_INVITE"] = "CODE"
    reward_coin: int = Field(default=30, ge=0, le=10000)


class CommonCheckinRandomMatchRequest(BaseModel):
    target_checkin_count: int = Field(default=15, ge=1, le=500)
    max_members: int = Field(default=5, ge=2, le=10)
    reward_coin: int = Field(default=30, ge=0, le=10000)


class CommonCheckinJoinByCodeRequest(BaseModel):
    group_code: str = Field(..., min_length=4, max_length=12)


class CommonCheckinMemberResponse(BaseModel):
    membership_id: int
    user_id: int
    nickname: Optional[str] = None
    profile_image: Optional[str] = None
    member_status: str
    join_source: str
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None
    contribution_count: int = 0
    reward_claimed_at: Optional[datetime] = None


class CommonCheckinGroupSummaryResponse(BaseModel):
    group_id: int
    title: Optional[str] = None
    group_code: str
    dolphin_name: Optional[str] = None
    join_mode: str
    status: str
    week_start_date: date
    week_end_date: date
    target_checkin_count: int
    current_checkin_count: int
    max_members: int
    member_count: int
    reward_coin: int
    created_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CommonCheckinGroupDetailResponse(CommonCheckinGroupSummaryResponse):
    my_member_status: Optional[str] = None
    can_join: bool = False
    can_claim_reward: bool = False
    members: list[CommonCheckinMemberResponse] = Field(default_factory=list)


class CommonCheckinRewardClaimResponse(BaseModel):
    group_id: int
    claimed_coin: int
    current_coin: int
    reward_claimed_at: datetime


class CommonCheckinEndingResponse(BaseModel):
    group: CommonCheckinGroupSummaryResponse
    result: Literal["SUCCESS", "FAILED"]
    ending_snapshot: Dict[str, Any] = Field(default_factory=dict)
