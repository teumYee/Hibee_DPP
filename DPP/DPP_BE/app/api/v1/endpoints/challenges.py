import random
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.calendar import CheckIn
from app.models.challenge import (
    StrollGroupCheckinContributions,
    StrollGroupMembers,
    StrollGroups,
)
from app.models.user import User_Stats, Users
from app.schemas.challenges import (
    CommonCheckinEndingResponse,
    CommonCheckinGroupCreateRequest,
    CommonCheckinGroupDetailResponse,
    CommonCheckinGroupSummaryResponse,
    CommonCheckinJoinByCodeRequest,
    CommonCheckinMemberResponse,
    CommonCheckinRandomMatchRequest,
    CommonCheckinRewardClaimResponse,
)

router = APIRouter()

JOINABLE_GROUP_STATUSES = {"RECRUITING", "ACTIVE"}
ENDED_GROUP_STATUSES = {"ENDED_SUCCESS", "ENDED_FAILED", "CANCELLED"}
ACTIVE_MEMBER_STATUS = "ACTIVE"


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


def _get_week_bounds(target_date: date | None = None) -> tuple[date, date]:
    base = target_date or date.today()
    week_start = base - timedelta(days=base.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def _normalize_group_code(value: str) -> str:
    return value.strip().upper()


def _generate_group_code(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(20):
        candidate = "".join(random.choice(alphabet) for _ in range(6))
        exists = db.query(StrollGroups.id).filter(StrollGroups.group_code == candidate).first()
        if not exists:
            return candidate
    raise HTTPException(status_code=500, detail="그룹 코드를 생성하지 못했습니다.")


def _generate_dolphin_name(group_code: str) -> str:
    adjectives = ["푸른", "맑은", "반짝", "포근", "유영", "파도"]
    nouns = ["돌핀", "버블", "산호", "해초", "물결", "산책단"]
    seed = sum(ord(char) for char in group_code)
    return f"{adjectives[seed % len(adjectives)]}{nouns[(seed // 3) % len(nouns)]}"


def _load_group(db: Session, group_id: int) -> StrollGroups:
    group = (
        db.query(StrollGroups)
        .options(
            joinedload(StrollGroups.members).joinedload(StrollGroupMembers.user),
            joinedload(StrollGroups.creator),
        )
        .filter(StrollGroups.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="공동 체크인 그룹을 찾을 수 없습니다.")
    return group


def _active_member_count(group: StrollGroups) -> int:
    return sum(1 for member in group.members if member.member_status == ACTIVE_MEMBER_STATUS)


def _get_group_member(group: StrollGroups, user_id: int) -> StrollGroupMembers | None:
    return next((member for member in group.members if member.user_id == user_id), None)


def _checkin_event_time(checkin: CheckIn) -> datetime:
    if checkin.completed_at:
        return checkin.completed_at
    return datetime.combine(checkin.date, time.max, tzinfo=timezone.utc)


def _build_eligible_checkin_query(db: Session, group: StrollGroups, member: StrollGroupMembers):
    joined_at = member.joined_at or datetime.now(timezone.utc)
    query = (
        db.query(CheckIn)
        .filter(
            CheckIn.user_id == member.user_id,
            CheckIn.is_completed.is_(True),
            CheckIn.date >= max(group.week_start_date, joined_at.date()),
            CheckIn.date <= group.week_end_date,
        )
    )

    query = query.filter(
        or_(
            and_(CheckIn.completed_at.isnot(None), CheckIn.completed_at >= joined_at),
            and_(CheckIn.completed_at.is_(None), CheckIn.date >= joined_at.date()),
        )
    )

    if member.left_at is not None:
        query = query.filter(
            or_(
                and_(CheckIn.completed_at.isnot(None), CheckIn.completed_at <= member.left_at),
                and_(CheckIn.completed_at.is_(None), CheckIn.date <= member.left_at.date()),
            )
        )

    if group.ended_at is not None:
        query = query.filter(
            or_(
                and_(CheckIn.completed_at.isnot(None), CheckIn.completed_at <= group.ended_at),
                and_(CheckIn.completed_at.is_(None), CheckIn.date <= group.ended_at.date()),
            )
        )

    return query.order_by(CheckIn.date.asc(), CheckIn.id.asc())


def _build_ending_snapshot(group: StrollGroups) -> dict:
    members = sorted(
        group.members,
        key=lambda item: (-int(item.contribution_count or 0), item.joined_at or datetime.min),
    )
    return {
        "group_id": group.id,
        "group_code": group.group_code,
        "dolphin_name": group.dolphin_name,
        "status": group.status,
        "target_checkin_count": int(group.target_checkin_count or 0),
        "current_checkin_count": int(group.current_checkin_count or 0),
        "participants": [
            {
                "user_id": member.user_id,
                "nickname": member.user.nickname if member.user else None,
                "profile_image": member.user.profile_image if member.user else None,
                "contribution_count": int(member.contribution_count or 0),
                "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                "left_at": member.left_at.isoformat() if member.left_at else None,
            }
            for member in members
        ],
    }


def _sync_group_progress(db: Session, group: StrollGroups) -> StrollGroups:
    group = _load_group(db, group.id)
    member_map = {
        member.user_id: member
        for member in group.members
        if member.member_status in {"ACTIVE", "LEFT"}
    }

    eligible_events: list[tuple[datetime, StrollGroupMembers, CheckIn]] = []
    for member in member_map.values():
        for checkin in _build_eligible_checkin_query(db, group, member).all():
            eligible_events.append((_checkin_event_time(checkin), member, checkin))

    eligible_events.sort(key=lambda item: (item[0], item[2].id))
    desired_events = eligible_events
    ended_at: datetime | None = None

    if group.status == "ENDED_SUCCESS" and group.ended_at is not None:
        ended_at = group.ended_at
        desired_events = [item for item in eligible_events if item[0] <= ended_at]
    elif len(eligible_events) >= int(group.target_checkin_count or 0):
        desired_events = eligible_events[: int(group.target_checkin_count)]
        ended_at = desired_events[-1][0]

    desired_by_key = {
        (member.user_id, checkin.date): (member, checkin)
        for _, member, checkin in desired_events
    }
    existing_contributions = (
        db.query(StrollGroupCheckinContributions)
        .filter(StrollGroupCheckinContributions.group_id == group.id)
        .all()
    )
    existing_by_key = {
        (contribution.user_id, contribution.checkin_date): contribution
        for contribution in existing_contributions
    }

    for key, contribution in existing_by_key.items():
        if key not in desired_by_key:
            db.delete(contribution)

    for key, (member, checkin) in desired_by_key.items():
        contribution = existing_by_key.get(key)
        if contribution:
            contribution.group_member_id = member.id
            contribution.checkin_id = checkin.id
            continue

        db.add(
            StrollGroupCheckinContributions(
                group_id=group.id,
                group_member_id=member.id,
                user_id=member.user_id,
                checkin_id=checkin.id,
                checkin_date=checkin.date,
            )
        )

    db.flush()

    contribution_rows = (
        db.query(
            StrollGroupCheckinContributions.group_member_id,
            func.count(StrollGroupCheckinContributions.id),
        )
        .filter(StrollGroupCheckinContributions.group_id == group.id)
        .group_by(StrollGroupCheckinContributions.group_member_id)
        .all()
    )
    counts_by_member_id = {member_id: count for member_id, count in contribution_rows}

    total_count = 0
    for member in group.members:
        member.contribution_count = int(counts_by_member_id.get(member.id, 0))
        total_count += int(member.contribution_count or 0)

    group.current_checkin_count = total_count

    today = date.today()
    if ended_at is not None:
        group.status = "ENDED_SUCCESS"
        group.ended_at = ended_at
    elif today > group.week_end_date:
        group.status = "ENDED_FAILED"
        group.ended_at = group.ended_at or datetime.now(timezone.utc)
    elif today < group.week_start_date:
        group.status = "RECRUITING"
        group.ended_at = None
    else:
        group.status = "ACTIVE"
        group.ended_at = None

    if group.status in ENDED_GROUP_STATUSES:
        group.ending_snapshot = _build_ending_snapshot(group)

    db.flush()
    return _load_group(db, group.id)


def _serialize_member(member: StrollGroupMembers) -> CommonCheckinMemberResponse:
    user = member.user
    return CommonCheckinMemberResponse(
        membership_id=member.id,
        user_id=member.user_id,
        nickname=user.nickname if user else None,
        profile_image=user.profile_image if user else None,
        member_status=member.member_status,
        join_source=member.join_source,
        joined_at=member.joined_at,
        left_at=member.left_at,
        contribution_count=int(member.contribution_count or 0),
        reward_claimed_at=member.reward_claimed_at,
    )


def _serialize_group_summary(group: StrollGroups) -> CommonCheckinGroupSummaryResponse:
    return CommonCheckinGroupSummaryResponse(
        group_id=group.id,
        title=group.title,
        group_code=group.group_code,
        dolphin_name=group.dolphin_name,
        join_mode=group.join_mode,
        status=group.status,
        week_start_date=group.week_start_date,
        week_end_date=group.week_end_date,
        target_checkin_count=int(group.target_checkin_count or 0),
        current_checkin_count=int(group.current_checkin_count or 0),
        max_members=int(group.max_members or 0),
        member_count=_active_member_count(group),
        reward_coin=int(group.reward_coin or 0),
        created_at=group.created_at,
        ended_at=group.ended_at,
    )


def _serialize_group_detail(group: StrollGroups, current_user_id: int) -> CommonCheckinGroupDetailResponse:
    my_member = _get_group_member(group, current_user_id)
    can_join = (
        my_member is None
        and group.status in JOINABLE_GROUP_STATUSES
        and _active_member_count(group) < int(group.max_members or 0)
    )
    can_claim_reward = bool(
        my_member
        and group.status == "ENDED_SUCCESS"
        and my_member.reward_claimed_at is None
    )

    return CommonCheckinGroupDetailResponse(
        **_serialize_group_summary(group).model_dump(),
        my_member_status=my_member.member_status if my_member else None,
        can_join=can_join,
        can_claim_reward=can_claim_reward,
        members=[_serialize_member(member) for member in group.members],
    )


def _get_current_membership(db: Session, user_id: int) -> StrollGroupMembers | None:
    memberships = (
        db.query(StrollGroupMembers)
        .options(joinedload(StrollGroupMembers.group))
        .filter(
            StrollGroupMembers.user_id == user_id,
            StrollGroupMembers.member_status == ACTIVE_MEMBER_STATUS,
        )
        .order_by(StrollGroupMembers.joined_at.desc(), StrollGroupMembers.id.desc())
        .all()
    )

    for membership in memberships:
        group = _sync_group_progress(db, membership.group)
        if group.status in JOINABLE_GROUP_STATUSES:
            return _get_group_member(group, user_id)
    return None


def _ensure_no_current_group(db: Session, user_id: int) -> None:
    current_membership = _get_current_membership(db, user_id)
    if current_membership:
        raise HTTPException(
            status_code=409,
            detail=f"이미 참여 중인 공동 체크인 그룹이 있습니다. group_id={current_membership.group_id}",
        )


def _create_group(
    db: Session,
    *,
    creator: Users,
    title: str | None,
    target_checkin_count: int,
    max_members: int,
    join_mode: str,
    reward_coin: int,
    join_source: str,
) -> StrollGroups:
    week_start, week_end = _get_week_bounds()
    group_code = _generate_group_code(db)
    group = StrollGroups(
        title=(title or "").strip() or None,
        group_code=group_code,
        join_mode=join_mode,
        status="ACTIVE",
        week_start_date=week_start,
        week_end_date=week_end,
        max_members=max_members,
        target_checkin_count=target_checkin_count,
        current_checkin_count=0,
        reward_coin=reward_coin,
        created_by_user_id=creator.id,
        dolphin_name=_generate_dolphin_name(group_code),
        challenge_started_at=datetime.now(timezone.utc),
    )
    db.add(group)
    db.flush()

    db.add(
        StrollGroupMembers(
            group_id=group.id,
            user_id=creator.id,
            member_status=ACTIVE_MEMBER_STATUS,
            join_source=join_source,
            joined_at=datetime.now(timezone.utc),
        )
    )
    db.flush()
    return _load_group(db, group.id)


def _join_group(db: Session, *, group: StrollGroups, user: Users, join_source: str) -> StrollGroups:
    group = _sync_group_progress(db, group)
    if group.status not in JOINABLE_GROUP_STATUSES:
        raise HTTPException(status_code=409, detail="현재 참여 가능한 그룹이 아닙니다.")
    if _active_member_count(group) >= int(group.max_members or 0):
        raise HTTPException(status_code=409, detail="그룹 정원이 모두 찼습니다.")

    existing_member = _get_group_member(group, user.id)
    if existing_member and existing_member.member_status == ACTIVE_MEMBER_STATUS:
        raise HTTPException(status_code=409, detail="이미 해당 그룹에 참여 중입니다.")

    if existing_member:
        existing_member.member_status = ACTIVE_MEMBER_STATUS
        existing_member.join_source = join_source
        existing_member.left_at = None
        existing_member.joined_at = datetime.now(timezone.utc)
    else:
        db.add(
            StrollGroupMembers(
                group_id=group.id,
                user_id=user.id,
                member_status=ACTIVE_MEMBER_STATUS,
                join_source=join_source,
                joined_at=datetime.now(timezone.utc),
            )
        )
    db.flush()
    return _load_group(db, group.id)


@router.post("/common-checkin/groups", response_model=CommonCheckinGroupDetailResponse)
def create_common_checkin_group(
    body: CommonCheckinGroupCreateRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    _ensure_no_current_group(db, current_user.id)

    try:
        group = _create_group(
            db,
            creator=current_user,
            title=body.title,
            target_checkin_count=body.target_checkin_count,
            max_members=body.max_members,
            join_mode=body.join_mode,
            reward_coin=body.reward_coin,
            join_source="CREATED",
        )
        group = _sync_group_progress(db, group)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="공동 체크인 그룹 생성 중 충돌이 발생했습니다.") from exc

    return _serialize_group_detail(group, current_user.id)


@router.post("/common-checkin/groups/random-match", response_model=CommonCheckinGroupDetailResponse)
def random_match_common_checkin_group(
    body: CommonCheckinRandomMatchRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    _ensure_no_current_group(db, current_user.id)

    week_start, week_end = _get_week_bounds()
    candidates = (
        db.query(StrollGroups)
        .filter(
            StrollGroups.week_start_date == week_start,
            StrollGroups.week_end_date == week_end,
            StrollGroups.join_mode == "RANDOM",
            StrollGroups.status.in_(JOINABLE_GROUP_STATUSES),
        )
        .order_by(StrollGroups.created_at.asc(), StrollGroups.id.asc())
        .with_for_update()
        .all()
    )

    try:
        for candidate in candidates:
            candidate = _sync_group_progress(db, candidate)
            if candidate.status not in JOINABLE_GROUP_STATUSES:
                continue
            if _active_member_count(candidate) >= int(candidate.max_members or 0):
                continue

            candidate = _join_group(db, group=candidate, user=current_user, join_source="RANDOM")
            db.commit()
            return _serialize_group_detail(_load_group(db, candidate.id), current_user.id)

        group = _create_group(
            db,
            creator=current_user,
            title=None,
            target_checkin_count=body.target_checkin_count,
            max_members=body.max_members,
            join_mode="RANDOM",
            reward_coin=body.reward_coin,
            join_source="RANDOM",
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="랜덤 그룹 매칭 중 충돌이 발생했습니다.") from exc

    return _serialize_group_detail(_load_group(db, group.id), current_user.id)


@router.get("/common-checkin/groups/search", response_model=CommonCheckinGroupDetailResponse)
def search_common_checkin_group(
    group_code: str = Query(..., min_length=4, max_length=12),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    normalized_code = _normalize_group_code(group_code)
    group = (
        db.query(StrollGroups)
        .filter(StrollGroups.group_code == normalized_code)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="해당 그룹 코드를 찾을 수 없습니다.")

    group = _sync_group_progress(db, group)
    db.commit()
    return _serialize_group_detail(group, current_user.id)


@router.post("/common-checkin/groups/join-by-code", response_model=CommonCheckinGroupDetailResponse)
def join_common_checkin_group_by_code(
    body: CommonCheckinJoinByCodeRequest,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    _ensure_no_current_group(db, current_user.id)

    group = (
        db.query(StrollGroups)
        .filter(StrollGroups.group_code == _normalize_group_code(body.group_code))
        .with_for_update()
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="해당 그룹 코드를 찾을 수 없습니다.")

    try:
        group = _join_group(db, group=group, user=current_user, join_source="CODE")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="그룹 입장 중 충돌이 발생했습니다.") from exc

    return _serialize_group_detail(_load_group(db, group.id), current_user.id)


@router.post("/common-checkin/groups/{group_id}/leave", response_model=CommonCheckinGroupDetailResponse)
def leave_common_checkin_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    group = _load_group(db, group_id)
    member = _get_group_member(group, current_user.id)
    if not member or member.member_status != ACTIVE_MEMBER_STATUS:
        raise HTTPException(status_code=404, detail="현재 참여 중인 그룹 멤버를 찾을 수 없습니다.")
    if group.status not in JOINABLE_GROUP_STATUSES:
        raise HTTPException(status_code=409, detail="이미 종료된 그룹에서는 나갈 수 없습니다.")

    member.member_status = "LEFT"
    member.left_at = datetime.now(timezone.utc)
    group = _sync_group_progress(db, group)
    db.commit()
    return _serialize_group_detail(group, current_user.id)


@router.get("/common-checkin/groups/current", response_model=CommonCheckinGroupDetailResponse)
def get_current_common_checkin_group(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    membership = _get_current_membership(db, current_user.id)
    if not membership:
        raise HTTPException(status_code=404, detail="현재 참여 중인 공동 체크인 그룹이 없습니다.")

    group = _sync_group_progress(db, membership.group)
    db.commit()
    return _serialize_group_detail(group, current_user.id)


@router.get("/common-checkin/groups/{group_id}", response_model=CommonCheckinGroupDetailResponse)
def get_common_checkin_group_detail(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    group = _load_group(db, group_id)
    member = _get_group_member(group, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="참여 중인 사용자만 그룹 상세를 조회할 수 있습니다.")

    group = _sync_group_progress(db, group)
    db.commit()
    return _serialize_group_detail(group, current_user.id)


@router.get("/common-checkin/groups/{group_id}/ending", response_model=CommonCheckinEndingResponse)
def get_common_checkin_group_ending(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    group = _load_group(db, group_id)
    member = _get_group_member(group, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="참여했던 사용자만 엔딩 정보를 조회할 수 있습니다.")

    group = _sync_group_progress(db, group)
    db.commit()
    if group.status not in {"ENDED_SUCCESS", "ENDED_FAILED"}:
        raise HTTPException(status_code=409, detail="아직 엔딩을 조회할 수 없는 그룹입니다.")

    return CommonCheckinEndingResponse(
        group=_serialize_group_summary(group),
        result="SUCCESS" if group.status == "ENDED_SUCCESS" else "FAILED",
        ending_snapshot=group.ending_snapshot or {},
    )


@router.post("/common-checkin/groups/{group_id}/rewards/claim", response_model=CommonCheckinRewardClaimResponse)
def claim_common_checkin_group_reward(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    group = _sync_group_progress(db, _load_group(db, group_id))
    member = _get_group_member(group, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="참여했던 사용자만 보상을 수령할 수 있습니다.")
    if group.status != "ENDED_SUCCESS":
        raise HTTPException(status_code=409, detail="성공 종료된 그룹에서만 보상을 수령할 수 있습니다.")
    if member.reward_claimed_at is not None:
        raise HTTPException(status_code=409, detail="이미 보상을 수령했습니다.")

    stats = _get_or_create_user_stats(db, current_user.id, for_update=True)
    claimed_at = datetime.now(timezone.utc)
    claimed_coin = int(group.reward_coin or 0)
    stats.coin = int(stats.coin or 0) + claimed_coin
    member.reward_claimed_at = claimed_at
    db.commit()

    return CommonCheckinRewardClaimResponse(
        group_id=group.id,
        claimed_coin=claimed_coin,
        current_coin=int(stats.coin or 0),
        reward_claimed_at=claimed_at,
    )
