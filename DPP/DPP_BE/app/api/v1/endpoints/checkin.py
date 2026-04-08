import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.runtime_flags import DEV_RELAXED_MODE
from app.models.calendar import CheckIn, PatternCandidatesDaily
from app.models.usage_log import Daily_SnapShots
from app.models.user import User_Configs, Users
from app.schemas.checkin import (
    CheckinAppSubmitBody,
    CheckinPatternEvidenceDTO,
    CheckinPatternItemDTO,
    CheckinPatternsResponseDTO,
    NightStatsResponseDTO,
)
from app.utils.checkin_policy import (
    CANONICAL_PACKAGE_NAME,
    current_logical_date,
    ensure_checkin_open,
)
from app.utils.pattern_candidates import normalize_pattern_candidates

router = APIRouter()

KPT_VALUES = frozenset({"keep", "problem", "try"})


def _stable_candidate_id(raw: dict, index: int) -> str:
    cid = str(raw.get("candidate_id") or raw.get("id") or "").strip()
    if cid:
        return cid
    label = str(raw.get("label") or "").strip()
    h = hashlib.sha256(f"{index}:{label}".encode("utf-8")).hexdigest()[:12]
    return f"auto-{h}"


def _candidates_to_fe_items(raw: Any) -> List[CheckinPatternItemDTO]:
    normalized = normalize_pattern_candidates(raw)
    out: List[CheckinPatternItemDTO] = []
    for i, c in enumerate(normalized):
        cid = _stable_candidate_id(c, i)
        ev = c.get("evidence") or {}
        if not isinstance(ev, dict):
            ev = {}
        nums: List[float] = []
        for x in ev.get("numbers") or []:
            try:
                nums.append(float(x))
            except (TypeError, ValueError):
                continue
        out.append(
            CheckinPatternItemDTO(
                candidate_id=cid,
                label=str(c.get("label") or ""),
                observation=str(c.get("observation") or ""),
                interpretation=str(c.get("interpretation") or ""),
                evidence=CheckinPatternEvidenceDTO(
                    metrics_used=[str(x) for x in (ev.get("metrics_used") or [])],
                    numbers=nums,
                ),
                tags=[str(x) for x in (c.get("tags") or [])],
            )
        )
    return out


def _lookup_by_candidate_id(raw: Any) -> Dict[str, dict]:
    normalized = normalize_pattern_candidates(raw)
    by_id: Dict[str, dict] = {}
    for i, c in enumerate(normalized):
        cid = _stable_candidate_id(c, i)
        d = dict(c)
        d["candidate_id"] = cid
        by_id[cid] = d
    return by_id


def _night_seconds_from_snapshot(row: Daily_SnapShots | None) -> int:
    if not row or not row.time_of_day_buckets_json:
        return 0
    buckets = row.time_of_day_buckets_json
    if not isinstance(buckets, dict):
        return 0
    v = buckets.get("night")
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _pairs_from_submit(body: CheckinAppSubmitBody) -> List[Tuple[str, str]]:
    ids = list(body.pattern_ids)
    tags = body.kpt_tags
    non_empty_idx: List[int] = []
    for i in range(3):
        if str(ids[i]).strip():
            non_empty_idx.append(i)
    if len(non_empty_idx) != len(tags):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비어 있지 않은 pattern_ids 개수와 kpt_tags 개수가 일치해야 합니다.",
        )
    pairs: List[Tuple[str, str]] = []
    for i, t in zip(non_empty_idx, tags):
        tag = str(t).strip().lower()
        if tag not in KPT_VALUES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="kpt_tags는 keep, problem, try 중 하나여야 합니다.",
            )
        pairs.append((str(ids[i]).strip(), tag))
    return pairs


@router.get("/stats/night", response_model=NightStatsResponseDTO)
def get_checkin_night_stats(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_config = db.query(User_Configs).filter(User_Configs.user_id == current_user.id).first()
    today = (
        current_logical_date(user_config)
        if DEV_RELAXED_MODE
        else ensure_checkin_open(user_config)["logical_date"]
    )
    snap = (
        db.query(Daily_SnapShots)
        .filter(
            Daily_SnapShots.user_id == current_user.id,
            Daily_SnapShots.snapshot_date == today,
            Daily_SnapShots.package_name == CANONICAL_PACKAGE_NAME,
        )
        .first()
    )
    sec = _night_seconds_from_snapshot(snap)
    return NightStatsResponseDTO(night_usage_seconds=sec)


@router.get("/patterns", response_model=CheckinPatternsResponseDTO)
def get_checkin_patterns(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_config = db.query(User_Configs).filter(User_Configs.user_id == current_user.id).first()
    today = (
        current_logical_date(user_config)
        if DEV_RELAXED_MODE
        else ensure_checkin_open(user_config)["logical_date"]
    )
    record = (
        db.query(PatternCandidatesDaily)
        .filter(
            PatternCandidatesDaily.user_id == current_user.id,
            PatternCandidatesDaily.date == today,
        )
        .first()
    )
    if not record or not record.candidates:
        return CheckinPatternsResponseDTO(patterns=[])
    return CheckinPatternsResponseDTO(patterns=_candidates_to_fe_items(record.candidates))


@router.post("/submit", status_code=status.HTTP_204_NO_CONTENT)
def submit_checkin_app(
    body: CheckinAppSubmitBody,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_config = db.query(User_Configs).filter(User_Configs.user_id == current_user.id).first()
    today = (
        current_logical_date(user_config)
        if DEV_RELAXED_MODE
        else ensure_checkin_open(user_config)["logical_date"]
    )
    pairs = _pairs_from_submit(body)

    record = (
        db.query(PatternCandidatesDaily)
        .filter(
            PatternCandidatesDaily.user_id == current_user.id,
            PatternCandidatesDaily.date == today,
        )
        .first()
    )
    lookup = _lookup_by_candidate_id(record.candidates if record else [])

    selected_patterns: List[Dict[str, Any]] = []
    keep_labels: List[str] = []
    problem_labels: List[str] = []
    try_labels: List[str] = []

    for pid, tag in pairs:
        src = lookup.get(pid)
        if src:
            d = dict(src)
            d["candidate_id"] = pid
            label = str(d.get("label") or "").strip() or pid
            selected_patterns.append(d)
        else:
            label = pid
            selected_patterns.append(
                {
                    "candidate_id": pid,
                    "label": label,
                    "observation": "",
                    "interpretation": "",
                    "evidence": {"metrics_used": [], "numbers": []},
                    "tags": [],
                }
            )
        if tag == "keep":
            keep_labels.append(label)
        elif tag == "problem":
            problem_labels.append(label)
        elif tag == "try":
            try_labels.append(label)

    kpt_keep = "\n".join(keep_labels) if keep_labels else None
    kpt_problem = "\n".join(problem_labels) if problem_labels else None
    kpt_try = "\n".join(try_labels) if try_labels else None

    existing = (
        db.query(CheckIn)
        .filter(
            CheckIn.user_id == current_user.id,
            CheckIn.date == today,
        )
        .first()
    )

    if existing:
        was_completed = bool(existing.is_completed)
        existing.selected_patterns = selected_patterns
        existing.kpt_keep = kpt_keep
        existing.kpt_problem = kpt_problem
        existing.kpt_try = kpt_try
        existing.is_completed = True
        if not was_completed:
            existing.completed_at = datetime.now(timezone.utc)
    else:
        db.add(
            CheckIn(
                user_id=current_user.id,
                date=today,
                selected_patterns=selected_patterns,
                kpt_keep=kpt_keep,
                kpt_problem=kpt_problem,
                kpt_try=kpt_try,
                is_completed=True,
                completed_at=datetime.now(timezone.utc),
            )
        )

    db.commit()
    return None
