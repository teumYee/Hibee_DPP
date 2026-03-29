from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SocialUserBase(BaseModel):
    user_id: int
    nickname: Optional[str] = None
    profile_image: Optional[str] = None


class UserProfileResponse(SocialUserBase):
    is_friend: bool
    request_status: Literal["NONE", "PENDING_SENT", "PENDING_RECEIVED", "ACCEPTED"]
    can_send_request: bool


class SocialBadge(BaseModel):
    achievement_id: int
    title: Optional[str] = None
    icon_url: Optional[str] = None
    achieved_at: Optional[datetime] = None


class SocialProfileResponse(UserProfileResponse):
    is_me: bool
    can_cheer: bool
    continuous_days: int = 0
    cheer_count: int = 0
    friend_count: int = 0
    badges: list[SocialBadge] = Field(default_factory=list)


class FriendProfileResponse(SocialProfileResponse):
    is_friend: bool = True
    can_cheer: bool = True


class FriendListItem(SocialUserBase):
    friendship_id: int


class FriendRequestCreate(BaseModel):
    requester_id: int
    receiver_id: int


class FriendRequestAction(BaseModel):
    user_id: int
    action: Literal["ACCEPT", "REJECT"]


class FriendRequestItem(BaseModel):
    request_id: int
    status: str
    created_at: Optional[datetime] = None
    user: SocialUserBase


class CheerCreate(BaseModel):
    sender_id: int
    message: str = Field(..., min_length=1, max_length=500)
