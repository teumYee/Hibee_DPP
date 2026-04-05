from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.gamification import (
    CharacterAcquisitionLogs,
    Characters,
    Items,
    UserCharacters,
    UserItems,
)
from app.models.user import User_Stats, Users
from app.schemas.gamification import (
    InventoryResponse,
    ItemEquipRequest,
    ItemPurchaseRequest,
    ItemPurchaseResponse,
    SeaFriendClaimResponse,
    SeaFriendClaimRequest,
    SeaFriendDetailResponse,
    SeaFriendListResponse,
    SeaFriendSummary,
    SeaRoomResponse,
    SeaRoomUpdateRequest,
    SetRepresentativeRequest,
    ShopItemResponse,
    EquippedItemResponse,
)

router = APIRouter()

ALLOWED_SOURCE_TYPES = {
    "CHECKIN_PATTERN",
    "TOP_APP",
    "TOP_CATEGORY",
    "GOAL_ACHIEVEMENT",
    "NIGHT_USAGE_SPECIAL",
    "MANUAL",
}

# grant_key 권장 규칙:
# <type>:<yyyymmdd>:<subject>
# 예) checkin:20260405:p1, top_app:20260405:youtube


def _get_or_create_user_stats(db: Session, user_id: int, *, for_update: bool = False) -> User_Stats:
    query = db.query(User_Stats).filter(User_Stats.user_id == user_id)
    if for_update:
        query = query.with_for_update()

    stats = query.first()
    if stats:
        if stats.coin is None:
            legacy_coin = db.query(Users.coin).filter(Users.id == user_id).scalar()
            stats.coin = int(legacy_coin or 0)
            db.flush()
        return stats

    legacy_coin = db.query(Users.coin).filter(Users.id == user_id).scalar()
    stats = User_Stats(
        user_id=user_id,
        coin=int(legacy_coin or 0),
        total_checkin_count=0,
        continuous_days=0,
        friend_count=0,
        cheer_count=0,
    )
    db.add(stats)
    db.flush()
    return stats


def _get_coin_balance(stats: User_Stats) -> int:
    return int(stats.coin or 0)


def _get_owned_user_character(db: Session, user_id: int, user_character_id: int) -> UserCharacters:
    user_character = (
        db.query(UserCharacters)
        .options(
            joinedload(UserCharacters.character),
            joinedload(UserCharacters.equipped_items).joinedload(UserItems.item),
        )
        .filter(
            UserCharacters.id == user_character_id,
            UserCharacters.user_id == user_id,
        )
        .first()
    )
    if not user_character:
        raise HTTPException(status_code=404, detail="보유한 바다 친구를 찾을 수 없습니다.")
    return user_character


def _get_owned_user_item(db: Session, user_id: int, user_item_id: int) -> UserItems:
    user_item = (
        db.query(UserItems)
        .options(joinedload(UserItems.item))
        .filter(UserItems.id == user_item_id, UserItems.user_id == user_id)
        .first()
    )
    if not user_item:
        raise HTTPException(status_code=404, detail="보유한 아이템을 찾을 수 없습니다.")
    return user_item


def _serialize_user_item(user_item: UserItems) -> EquippedItemResponse:
    item = user_item.item
    return EquippedItemResponse(
        user_item_id=user_item.id,
        item_id=user_item.item_id,
        name=item.name if item else "Unknown",
        item_type=item.item_type if item else None,
        slot_type=item.slot_type if item else None,
        image_url=item.image_url if item else None,
        is_equipped=bool(user_item.is_equipped),
        equipped_slot=user_item.equipped_slot,
    )


def _serialize_user_character(
    user_character: UserCharacters,
    representative_character_id: int | None,
) -> SeaFriendSummary:
    character = user_character.character
    return SeaFriendSummary(
        user_character_id=user_character.id,
        character_id=user_character.character_id,
        character_name=character.name if character else "Unknown",
        display_name=user_character.display_name or (character.name if character else "Unknown"),
        image_url=character.image_url if character else None,
        acquired_at=user_character.acquired_at,
        source_type=user_character.source_type,
        source_date=user_character.source_date,
        rarity=user_character.rarity or "common",
        is_special=bool(user_character.is_special),
        is_representative=user_character.id == representative_character_id,
        room_slot=user_character.room_slot,
        room_position=user_character.room_position or None,
    )


def _serialize_user_character_detail(
    user_character: UserCharacters,
    representative_character_id: int | None,
) -> SeaFriendDetailResponse:
    summary = _serialize_user_character(user_character, representative_character_id)
    return SeaFriendDetailResponse(
        **summary.model_dump(),
        source_key=user_character.source_key,
        source_payload=user_character.source_payload or {},
        equipped_items=[
            _serialize_user_item(user_item)
            for user_item in user_character.equipped_items
            if user_item.item is not None
        ],
    )


@router.get("/sea-friends", response_model=SeaFriendListResponse)
def get_sea_friends(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    stats = _get_or_create_user_stats(db, current_user.id)
    user_characters = (
        db.query(UserCharacters)
        .options(joinedload(UserCharacters.character))
        .filter(UserCharacters.user_id == current_user.id)
        .order_by(UserCharacters.acquired_at.desc(), UserCharacters.id.desc())
        .all()
    )

    return SeaFriendListResponse(
        representative_character_id=stats.social_representative_character_id,
        sea_friends=[
            _serialize_user_character(user_character, stats.social_representative_character_id)
            for user_character in user_characters
        ],
    )


@router.get("/sea-friends/{user_character_id}", response_model=SeaFriendDetailResponse)
def get_sea_friend_detail(
    user_character_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    stats = _get_or_create_user_stats(db, current_user.id)
    user_character = _get_owned_user_character(db, current_user.id, user_character_id)
    return _serialize_user_character_detail(user_character, stats.social_representative_character_id)


@router.post("/sea-friends/claim", response_model=SeaFriendClaimResponse)
def claim_sea_friends(
    body: SeaFriendClaimRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if not body.claims:
        raise HTTPException(status_code=400, detail="획득할 바다 친구 정보가 비어 있습니다.")

    stats = _get_or_create_user_stats(db, current_user.id, for_update=True)
    created_ids: list[int] = []
    skipped_keys: list[str] = []

    try:
        with db.begin_nested():
            for claim in body.claims:
                source_type = claim.source_type.strip().upper()
                source_key = claim.source_key.strip()
                if source_type not in ALLOWED_SOURCE_TYPES:
                    raise HTTPException(status_code=400, detail=f"지원하지 않는 획득 타입입니다: {source_type}")

                character = db.query(Characters).filter(Characters.id == claim.character_id).first()
                if not character:
                    raise HTTPException(status_code=404, detail=f"캐릭터를 찾을 수 없습니다: {claim.character_id}")

                existing_log = (
                    db.query(CharacterAcquisitionLogs)
                    .filter(
                        CharacterAcquisitionLogs.user_id == current_user.id,
                        CharacterAcquisitionLogs.grant_type == source_type,
                        CharacterAcquisitionLogs.grant_key == source_key,
                    )
                    .first()
                )
                if existing_log:
                    skipped_keys.append(source_key)
                    continue

                user_character = UserCharacters(
                    user_id=current_user.id,
                    character_id=character.id,
                    display_name=(claim.display_name or character.name).strip(),
                    source_type=source_type,
                    source_key=source_key,
                    source_date=claim.source_date or date.today(),
                    source_payload=claim.source_payload,
                    rarity=(claim.rarity or "common").strip().lower(),
                    is_special=bool(claim.is_special or source_type == "NIGHT_USAGE_SPECIAL"),
                )
                db.add(user_character)
                db.flush()

                db.add(
                    CharacterAcquisitionLogs(
                        user_id=current_user.id,
                        user_character_id=user_character.id,
                        grant_type=source_type,
                        grant_key=source_key,
                        grant_date=user_character.source_date,
                        payload=claim.source_payload,
                    )
                )
                db.flush()
                created_ids.append(user_character.id)

                if stats.social_representative_character_id is None:
                    stats.social_representative_character_id = user_character.id

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 지급 처리된 바다 친구 보상입니다.") from exc

    created_characters = [
        _get_owned_user_character(db, current_user.id, created_id) for created_id in created_ids
    ]
    return SeaFriendClaimResponse(
        created=[
            _serialize_user_character_detail(user_character, stats.social_representative_character_id)
            for user_character in created_characters
        ],
        skipped_keys=skipped_keys,
        representative_character_id=stats.social_representative_character_id,
    )


@router.put("/sea-friends/representative", response_model=SeaFriendDetailResponse)
def set_social_representative(
    body: SetRepresentativeRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    stats = _get_or_create_user_stats(db, current_user.id)
    user_character = _get_owned_user_character(db, current_user.id, body.user_character_id)
    stats.social_representative_character_id = user_character.id
    db.commit()
    return _serialize_user_character_detail(user_character, user_character.id)


@router.get("/sea-room", response_model=SeaRoomResponse)
def get_sea_room(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    stats = _get_or_create_user_stats(db, current_user.id)
    user_characters = (
        db.query(UserCharacters)
        .options(joinedload(UserCharacters.character))
        .filter(UserCharacters.user_id == current_user.id)
        .all()
    )

    placements = [
        _serialize_user_character(user_character, stats.social_representative_character_id)
        for user_character in user_characters
        if user_character.room_slot is not None
    ]
    placements.sort(key=lambda item: item.room_slot or 9999)

    return SeaRoomResponse(
        representative_character_id=stats.social_representative_character_id,
        placements=placements,
    )


@router.put("/sea-room", response_model=SeaRoomResponse)
def save_sea_room(
    body: SeaRoomUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    seen_slots = set()
    for placement in body.placements:
        if placement.room_slot in seen_slots:
            raise HTTPException(status_code=400, detail="같은 room_slot은 한 번만 사용할 수 있습니다.")
        seen_slots.add(placement.room_slot)

    user_characters = (
        db.query(UserCharacters)
        .filter(UserCharacters.user_id == current_user.id)
        .all()
    )
    owned_map = {user_character.id: user_character for user_character in user_characters}

    for placement in body.placements:
        if placement.user_character_id not in owned_map:
            raise HTTPException(status_code=404, detail="배치 대상 바다 친구를 찾을 수 없습니다.")

    for user_character in user_characters:
        user_character.room_slot = None
        user_character.room_position = None

    for placement in body.placements:
        target = owned_map[placement.user_character_id]
        target.room_slot = placement.room_slot
        target.room_position = placement.room_position

    db.commit()
    return get_sea_room(db=db, current_user=current_user)


@router.get("/inventory", response_model=InventoryResponse)
def get_inventory(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    stats = _get_or_create_user_stats(db, current_user.id)
    user_items = (
        db.query(UserItems)
        .options(joinedload(UserItems.item))
        .filter(UserItems.user_id == current_user.id)
        .order_by(UserItems.purchased_at.desc(), UserItems.id.desc())
        .all()
    )
    user_characters = (
        db.query(UserCharacters)
        .options(joinedload(UserCharacters.character))
        .filter(UserCharacters.user_id == current_user.id)
        .order_by(UserCharacters.acquired_at.desc(), UserCharacters.id.desc())
        .all()
    )

    current_coin = _get_coin_balance(stats)
    return InventoryResponse(
        coins=int(current_coin),
        items=[_serialize_user_item(user_item) for user_item in user_items if user_item.item is not None],
        sea_friends=[
            _serialize_user_character(user_character, stats.social_representative_character_id)
            for user_character in user_characters
        ],
    )


@router.get("/shop/items", response_model=list[ShopItemResponse])
def get_shop_items(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    shop_items = db.query(Items).order_by(Items.coin.asc(), Items.id.asc()).all()
    owned_items = db.query(UserItems).filter(UserItems.user_id == current_user.id).all()

    owned_count_by_item: dict[int, int] = {}
    for user_item in owned_items:
        owned_count_by_item[user_item.item_id] = owned_count_by_item.get(user_item.item_id, 0) + 1

    return [
        ShopItemResponse(
            item_id=item.id,
            name=item.name,
            description=item.description,
            coin=item.coin or 0,
            item_type=item.item_type,
            slot_type=item.slot_type,
            image_url=item.image_url,
            owned_count=owned_count_by_item.get(item.id, 0),
        )
        for item in shop_items
    ]


@router.post("/items/purchase", response_model=ItemPurchaseResponse)
def purchase_item(
    body: ItemPurchaseRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    item = db.query(Items).filter(Items.id == body.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="구매할 아이템을 찾을 수 없습니다.")

    purchased_item_ids: list[int] = []
    try:
        with db.begin_nested():
            stats = _get_or_create_user_stats(db, current_user.id, for_update=True)
            current_coin = _get_coin_balance(stats)
            total_cost = int(item.coin or 0) * body.quantity
            if current_coin < total_cost:
                raise HTTPException(status_code=400, detail="코인이 부족합니다.")

            for _ in range(body.quantity):
                user_item = UserItems(user_id=current_user.id, item_id=item.id)
                db.add(user_item)
                db.flush()
                purchased_item_ids.append(user_item.id)

            remaining_coin = current_coin - total_cost
            stats.coin = remaining_coin

        db.commit()
    except HTTPException:
        db.rollback()
        raise

    return ItemPurchaseResponse(
        purchased_item_ids=purchased_item_ids,
        remaining_coin=remaining_coin,
    )


@router.put("/items/{user_item_id}/equip", response_model=EquippedItemResponse)
def equip_item(
    user_item_id: int,
    body: ItemEquipRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_item = _get_owned_user_item(db, current_user.id, user_item_id)
    user_character = _get_owned_user_character(db, current_user.id, body.user_character_id)

    slot_name = (
        (body.equipped_slot or "").strip()
        or (user_item.item.slot_type if user_item.item and user_item.item.slot_type else "")
        or (user_item.item.item_type if user_item.item and user_item.item.item_type else "")
        or "default"
    )

    conflicting_items = (
        db.query(UserItems)
        .filter(
            UserItems.user_id == current_user.id,
            UserItems.user_character_id == user_character.id,
            UserItems.equipped_slot == slot_name,
            UserItems.is_equipped.is_(True),
            UserItems.id != user_item.id,
        )
        .all()
    )
    for conflicting_item in conflicting_items:
        conflicting_item.is_equipped = False
        conflicting_item.user_character_id = None
        conflicting_item.equipped_slot = None

    user_item.user_character_id = user_character.id
    user_item.is_equipped = True
    user_item.equipped_slot = slot_name
    db.commit()
    return _serialize_user_item(user_item)


@router.put("/items/{user_item_id}/unequip", response_model=EquippedItemResponse)
def unequip_item(
    user_item_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_item = _get_owned_user_item(db, current_user.id, user_item_id)
    user_item.is_equipped = False
    user_item.user_character_id = None
    user_item.equipped_slot = None
    db.commit()
    return _serialize_user_item(user_item)
