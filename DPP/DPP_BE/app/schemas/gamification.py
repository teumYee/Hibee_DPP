from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EquippedItemResponse(BaseModel):
    user_item_id: int
    item_id: int
    name: str
    item_type: Optional[str] = None
    slot_type: Optional[str] = None
    image_url: Optional[str] = None
    is_equipped: bool
    equipped_slot: Optional[str] = None


class SeaFriendSummary(BaseModel):
    user_character_id: int
    character_id: int
    character_name: str
    display_name: str
    image_url: Optional[str] = None
    acquired_at: Optional[datetime] = None
    source_type: Optional[str] = None
    source_date: Optional[date] = None
    rarity: str = "common"
    is_special: bool = False
    is_representative: bool = False
    room_slot: Optional[int] = None
    room_position: Optional[Dict[str, Any]] = None


class SeaFriendDetailResponse(SeaFriendSummary):
    source_key: Optional[str] = None
    source_payload: Dict[str, Any] = Field(default_factory=dict)
    equipped_items: List[EquippedItemResponse] = Field(default_factory=list)


class SeaFriendListResponse(BaseModel):
    representative_character_id: Optional[int] = None
    sea_friends: List[SeaFriendSummary] = Field(default_factory=list)


class SeaFriendClaimItem(BaseModel):
    character_id: int
    display_name: Optional[str] = Field(default=None, max_length=50)
    source_type: str
    source_key: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="중복 지급 방지용 grant_key. 권장 형식: <type>:<yyyymmdd>:<subject> 예) checkin:20260405:p1",
    )
    source_date: Optional[date] = None
    source_payload: Dict[str, Any] = Field(default_factory=dict)
    rarity: str = "common"
    is_special: bool = False


class SeaFriendClaimRequest(BaseModel):
    claims: List[SeaFriendClaimItem] = Field(default_factory=list, max_length=3)


class SeaFriendClaimResponse(BaseModel):
    created: List[SeaFriendDetailResponse] = Field(default_factory=list)
    skipped_keys: List[str] = Field(default_factory=list)
    representative_character_id: Optional[int] = None


class SetRepresentativeRequest(BaseModel):
    user_character_id: int


class SeaRoomPlacement(BaseModel):
    user_character_id: int
    room_slot: int = Field(..., ge=1, le=12)
    room_position: Optional[Dict[str, Any]] = None


class SeaRoomUpdateRequest(BaseModel):
    placements: List[SeaRoomPlacement] = Field(default_factory=list)


class SeaRoomResponse(BaseModel):
    representative_character_id: Optional[int] = None
    placements: List[SeaFriendSummary] = Field(default_factory=list)


class ShopItemResponse(BaseModel):
    item_id: int
    name: str
    description: Optional[str] = None
    coin: int
    item_type: Optional[str] = None
    slot_type: Optional[str] = None
    image_url: Optional[str] = None
    owned_count: int = 0


class InventoryResponse(BaseModel):
    coins: int
    items: List[EquippedItemResponse] = Field(default_factory=list)
    sea_friends: List[SeaFriendSummary] = Field(default_factory=list)


class ItemPurchaseRequest(BaseModel):
    item_id: int
    quantity: int = Field(default=1, ge=1, le=10)


class ItemPurchaseResponse(BaseModel):
    purchased_item_ids: List[int] = Field(default_factory=list)
    remaining_coin: int


class ItemEquipRequest(BaseModel):
    user_character_id: int
    equipped_slot: Optional[str] = Field(default=None, max_length=50)
