from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.gamification import UserAchievements
from app.models.social import Alerts, Friendships
from app.models.user import User_Stats, Users
from app.schemas.social import (
    CheerCreate,
    FriendListItem,
    FriendProfileResponse,
    FriendRequestAction,
    FriendRequestCreate,
    FriendRequestItem,
    SocialBadge,
    SocialProfileResponse,
    SocialUserBase,
    UserProfileResponse,
)

router = APIRouter()


def _get_user_or_404(db: Session, user_id: int) -> Users:
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return user


def _get_relationship(db: Session, user_id: int, other_user_id: int) -> Friendships | None:
    return (
        db.query(Friendships)
        .filter(
            or_(
                and_(
                    Friendships.requester_id == user_id,
                    Friendships.receiver_id == other_user_id,
                ),
                and_(
                    Friendships.requester_id == other_user_id,
                    Friendships.receiver_id == user_id,
                ),
            )
        )
        .first()
    )


def _get_relationship_state(
    db: Session, user_id: int, other_user_id: int
) -> tuple[Friendships | None, str, bool, bool]:
    relationship = _get_relationship(db, user_id, other_user_id)
    if not relationship:
        return None, "NONE", False, True

    if relationship.status == "ACCEPTED":
        return relationship, "ACCEPTED", True, False

    if relationship.requester_id == user_id:
        return relationship, "PENDING_SENT", False, False

    return relationship, "PENDING_RECEIVED", False, False


def _to_social_user(user: Users) -> SocialUserBase:
    return SocialUserBase(
        user_id=user.id,
        nickname=user.nickname,
        profile_image=user.profile_image,
    )


def _update_friend_count(db: Session, user_id: int, diff: int) -> None:
    stats = _get_or_create_user_stats(db, user_id)
    current = stats.friend_count or 0
    stats.friend_count = max(0, current + diff)


def _update_cheer_count(db: Session, user_id: int, diff: int) -> None:
    stats = _get_or_create_user_stats(db, user_id)
    current = stats.cheer_count or 0
    stats.cheer_count = max(0, current + diff)


def _is_friend(db: Session, user_id: int, other_user_id: int) -> bool:
    relationship = _get_relationship(db, user_id, other_user_id)
    return bool(relationship and relationship.status == "ACCEPTED")


def _get_or_create_user_stats(db: Session, user_id: int) -> User_Stats:
    stats = db.query(User_Stats).filter(User_Stats.user_id == user_id).first()
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


def _get_user_stats(db: Session, user_id: int) -> User_Stats | None:
    return db.query(User_Stats).filter(User_Stats.user_id == user_id).first()


def _get_badges(db: Session, user_id: int) -> list[SocialBadge]:
    achievements = (
        db.query(UserAchievements)
        .filter(UserAchievements.user_id == user_id)
        .order_by(UserAchievements.achieved_at.desc())
        .all()
    )

    return [
        SocialBadge(
            achievement_id=achievement.achievement_id,
            title=achievement.achievement.title if achievement.achievement else None,
            icon_url=achievement.achievement.icon_url if achievement.achievement else None,
            achieved_at=achievement.achieved_at,
        )
        for achievement in achievements
    ]


def _build_social_profile(
    db: Session,
    current_user_id: int,
    target_user: Users,
    *,
    require_friend: bool = False,
) -> SocialProfileResponse:
    _, request_status, is_friend, can_send_request = _get_relationship_state(
        db, current_user_id, target_user.id
    )

    is_me = current_user_id == target_user.id
    if is_me:
        request_status = "NONE"
        is_friend = False
        can_send_request = False

    if require_friend and not is_friend:
        raise HTTPException(status_code=403, detail="친구인 사용자만 상세 프로필을 조회할 수 있습니다.")

    stats = _get_user_stats(db, target_user.id)

    return SocialProfileResponse(
        user_id=target_user.id,
        nickname=target_user.nickname,
        profile_image=target_user.profile_image,
        is_friend=is_friend,
        request_status=request_status,
        can_send_request=can_send_request,
        is_me=is_me,
        can_cheer=is_friend and not is_me,
        continuous_days=stats.continuous_days if stats else 0,
        cheer_count=stats.cheer_count if stats else 0,
        friend_count=stats.friend_count if stats else 0,
        badges=_get_badges(db, target_user.id),
    )


@router.get("/users/search", response_model=list[UserProfileResponse])
def search_users(
    user_id: int,
    nickname: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    _get_user_or_404(db, user_id)

    users = (
        db.query(Users)
        .filter(
            Users.id != user_id,
            Users.nickname.isnot(None),
            Users.nickname.ilike(f"%{nickname.strip()}%"),
        )
        .order_by(Users.nickname.asc())
        .all()
    )

    results = []
    for user in users:
        _, request_status, is_friend, can_send_request = _get_relationship_state(
            db, user_id, user.id
        )
        results.append(
            UserProfileResponse(
                user_id=user.id,
                nickname=user.nickname,
                profile_image=user.profile_image,
                is_friend=is_friend,
                request_status=request_status,
                can_send_request=can_send_request,
            )
        )

    return results


@router.get("/users/{target_user_id}", response_model=UserProfileResponse)
def get_user_profile(
    target_user_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    _get_user_or_404(db, user_id)
    target_user = _get_user_or_404(db, target_user_id)

    _, request_status, is_friend, can_send_request = _get_relationship_state(
        db, user_id, target_user_id
    )

    if user_id == target_user_id:
        request_status = "NONE"
        is_friend = False
        can_send_request = False

    return UserProfileResponse(
        user_id=target_user.id,
        nickname=target_user.nickname,
        profile_image=target_user.profile_image,
        is_friend=is_friend,
        request_status=request_status,
        can_send_request=can_send_request,
    )


@router.get("/me/profile", response_model=SocialProfileResponse)
def get_my_social_profile(user_id: int, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    return _build_social_profile(db, user.id, user)


@router.get("/users/{target_user_id}/profile", response_model=SocialProfileResponse)
def get_user_social_profile(
    target_user_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    _get_user_or_404(db, user_id)
    target_user = _get_user_or_404(db, target_user_id)
    return _build_social_profile(db, user_id, target_user)


@router.get("/friends/requests/received", response_model=list[FriendRequestItem])
def get_received_friend_requests(user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)

    requests = (
        db.query(Friendships)
        .filter(
            Friendships.receiver_id == user_id,
            Friendships.status == "PENDING",
        )
        .order_by(Friendships.created_at.desc())
        .all()
    )

    return [
        FriendRequestItem(
            request_id=request.id,
            status=request.status,
            created_at=request.created_at,
            user=_to_social_user(request.requester),
        )
        for request in requests
    ]


@router.get("/friends/requests/sent", response_model=list[FriendRequestItem])
def get_sent_friend_requests(user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)

    requests = (
        db.query(Friendships)
        .filter(
            Friendships.requester_id == user_id,
            Friendships.status == "PENDING",
        )
        .order_by(Friendships.created_at.desc())
        .all()
    )

    return [
        FriendRequestItem(
            request_id=request.id,
            status=request.status,
            created_at=request.created_at,
            user=_to_social_user(request.receiver),
        )
        for request in requests
    ]


@router.post("/friends/requests")
def send_friend_request(body: FriendRequestCreate, db: Session = Depends(get_db)):
    requester = _get_user_or_404(db, body.requester_id)
    receiver = _get_user_or_404(db, body.receiver_id)

    if requester.id == receiver.id:
        raise HTTPException(status_code=400, detail="자기 자신에게 친구 요청을 보낼 수 없습니다.")

    existing, request_status, is_friend, _ = _get_relationship_state(
        db, body.requester_id, body.receiver_id
    )

    if is_friend:
        raise HTTPException(status_code=409, detail="이미 친구 관계입니다.")

    if existing:
        if request_status == "PENDING_SENT":
            raise HTTPException(status_code=409, detail="이미 친구 요청을 보냈습니다.")
        raise HTTPException(
            status_code=409,
            detail="상대방이 먼저 보낸 친구 요청이 있습니다. 수락/거절 API를 사용해주세요.",
        )

    friendship = Friendships(
        requester_id=body.requester_id,
        receiver_id=body.receiver_id,
        status="PENDING",
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    return {
        "message": "친구 요청을 보냈습니다.",
        "request_id": friendship.id,
        "status": friendship.status,
    }


@router.patch("/friends/requests/{request_id}")
def respond_friend_request(
    request_id: int,
    body: FriendRequestAction,
    db: Session = Depends(get_db),
):
    _get_user_or_404(db, body.user_id)

    friendship = db.query(Friendships).filter(Friendships.id == request_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="친구 요청을 찾을 수 없습니다.")

    if friendship.receiver_id != body.user_id:
        raise HTTPException(status_code=403, detail="해당 친구 요청을 처리할 권한이 없습니다.")

    if friendship.status != "PENDING":
        raise HTTPException(status_code=400, detail="이미 처리된 친구 요청입니다.")

    if body.action == "ACCEPT":
        friendship.status = "ACCEPTED"
        _update_friend_count(db, friendship.requester_id, 1)
        _update_friend_count(db, friendship.receiver_id, 1)
        db.commit()
        db.refresh(friendship)
        return {
            "message": "친구 요청을 수락했습니다.",
            "request_id": friendship.id,
            "status": friendship.status,
        }

    db.delete(friendship)
    db.commit()
    return {"message": "친구 요청을 거절했습니다."}


@router.get("/friends", response_model=list[FriendListItem])
def get_friend_list(user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)

    friendships = (
        db.query(Friendships)
        .filter(
            Friendships.status == "ACCEPTED",
            or_(
                Friendships.requester_id == user_id,
                Friendships.receiver_id == user_id,
            ),
        )
        .order_by(Friendships.created_at.desc())
        .all()
    )

    friends = []
    for friendship in friendships:
        friend_user = (
            friendship.receiver if friendship.requester_id == user_id else friendship.requester
        )
        friends.append(
            FriendListItem(
                friendship_id=friendship.id,
                user_id=friend_user.id,
                nickname=friend_user.nickname,
                profile_image=friend_user.profile_image,
            )
        )

    return friends


@router.get("/friends/{friend_user_id}", response_model=FriendProfileResponse)
def get_friend_profile(
    friend_user_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    _get_user_or_404(db, user_id)
    friend_user = _get_user_or_404(db, friend_user_id)
    profile = _build_social_profile(db, user_id, friend_user, require_friend=True)
    return FriendProfileResponse(**profile.dict())


@router.delete("/friends/{friend_user_id}")
def delete_friend(friend_user_id: int, user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)
    _get_user_or_404(db, friend_user_id)

    friendship = _get_relationship(db, user_id, friend_user_id)
    if not friendship or friendship.status != "ACCEPTED":
        raise HTTPException(status_code=404, detail="친구 관계를 찾을 수 없습니다.")

    db.delete(friendship)
    _update_friend_count(db, user_id, -1)
    _update_friend_count(db, friend_user_id, -1)
    db.commit()

    return {"message": "친구를 삭제했습니다."}


@router.post("/friends/{friend_user_id}/cheer")
def cheer_friend(
    friend_user_id: int,
    body: CheerCreate,
    db: Session = Depends(get_db),
):
    sender = _get_user_or_404(db, body.sender_id)
    receiver = _get_user_or_404(db, friend_user_id)

    if sender.id == receiver.id:
        raise HTTPException(status_code=400, detail="자기 자신에게 응원을 보낼 수 없습니다.")

    if not _is_friend(db, sender.id, receiver.id):
        raise HTTPException(status_code=403, detail="친구에게만 응원을 보낼 수 있습니다.")

    alert = Alerts(
        receiver_id=receiver.id,
        sender_id=sender.id,
        alerts_type="NUDGE",
        message=body.message.strip(),
    )
    db.add(alert)
    _update_cheer_count(db, receiver.id, 1)
    db.commit()
    db.refresh(alert)

    return {
        "message": "응원을 보냈습니다.",
        "alert_id": alert.id,
        "receiver_id": receiver.id,
    }
