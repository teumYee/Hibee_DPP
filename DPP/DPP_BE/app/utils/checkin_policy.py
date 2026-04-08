from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.models.user import User_Configs

CANONICAL_PACKAGE_NAME = "__all__"
DEFAULT_CHECKIN_TIME = "21:00"
DEFAULT_CHECKIN_WINDOW_MINUTES = 120
DEFAULT_DAY_ROLLOVER_TIME = DEFAULT_CHECKIN_TIME
DEFAULT_TIMEZONE = "Asia/Seoul"


def _safe_zoneinfo(timezone_name: str | None) -> tzinfo:
    key = (timezone_name or "").strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(key)
    except Exception:
        # Windows/Python 환경에 tzdata가 없을 수 있으므로 주요 기본값은 고정 오프셋으로 fallback 한다.
        if key == "Asia/Seoul" or key == DEFAULT_TIMEZONE:
            return timezone(timedelta(hours=9), name="Asia/Seoul")
        return timezone.utc


def normalize_hhmm(value: str | None, fallback: str) -> str:
    raw = (value or "").strip()
    parts = raw.split(":")
    if len(parts) != 2 or not all(part.isdigit() for part in parts):
        return fallback

    hour, minute = (int(part) for part in parts)
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return fallback
    return f"{hour:02d}:{minute:02d}"


def hhmm_to_time(value: str | None, fallback: str) -> time:
    normalized = normalize_hhmm(value, fallback)
    hour_s, minute_s = normalized.split(":")
    return time(hour=int(hour_s), minute=int(minute_s))


def normalize_window_minutes(value: int | None, fallback: int = DEFAULT_CHECKIN_WINDOW_MINUTES) -> int:
    try:
        minutes = int(value if value is not None else fallback)
    except (TypeError, ValueError):
        return fallback
    return minutes if minutes > 0 else fallback


@dataclass(frozen=True)
class CheckinPolicy:
    timezone: str
    checkin_time: str
    checkin_window_minutes: int
    day_rollover_time: str


def policy_from_config(
    user_config: User_Configs | None,
    *,
    timezone_name: str | None = None,
) -> CheckinPolicy:
    checkin_time = normalize_hhmm(
        user_config.checkin_time if user_config else None,
        DEFAULT_CHECKIN_TIME,
    )
    return CheckinPolicy(
        timezone=(timezone_name or "").strip() or DEFAULT_TIMEZONE,
        checkin_time=checkin_time,
        checkin_window_minutes=normalize_window_minutes(
            user_config.checkin_window_minutes if user_config else None,
        ),
        day_rollover_time=normalize_hhmm(
            user_config.day_rollover_time if user_config else None,
            checkin_time,
        ),
    )


def resolve_logical_date(
    now: datetime,
    *,
    day_rollover_time: str,
    timezone_name: str | None = None,
) -> date:
    zone = _safe_zoneinfo(timezone_name)
    current = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    local_now = current.astimezone(zone)
    rollover = hhmm_to_time(day_rollover_time, DEFAULT_DAY_ROLLOVER_TIME)
    logical_date = local_now.date()
    if local_now.timetz().replace(tzinfo=None) < rollover:
        logical_date -= timedelta(days=1)
    return logical_date


def current_logical_date(
    user_config: User_Configs | None,
    *,
    timezone_name: str | None = None,
    now: datetime | None = None,
) -> date:
    policy = policy_from_config(user_config, timezone_name=timezone_name)
    return resolve_logical_date(
        now or datetime.now(timezone.utc),
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )


def latest_completed_logical_date(
    user_config: User_Configs | None,
    *,
    timezone_name: str | None = None,
    now: datetime | None = None,
) -> date:
    return current_logical_date(
        user_config,
        timezone_name=timezone_name,
        now=now,
    ) - timedelta(days=1)


def logical_date_bounds(
    logical_date: date,
    *,
    day_rollover_time: str,
    timezone_name: str | None = None,
) -> tuple[datetime, datetime]:
    zone = _safe_zoneinfo(timezone_name)
    rollover = hhmm_to_time(day_rollover_time, DEFAULT_DAY_ROLLOVER_TIME)
    start_local = datetime.combine(logical_date, rollover, tzinfo=zone)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def current_logical_bounds(
    user_config: User_Configs | None,
    *,
    timezone_name: str | None = None,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    policy = policy_from_config(user_config, timezone_name=timezone_name)
    logical_date = resolve_logical_date(
        now or datetime.now(timezone.utc),
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )
    return logical_date_bounds(
        logical_date,
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )


def checkin_window_state(
    user_config: User_Configs | None,
    *,
    timezone_name: str | None = None,
    now: datetime | None = None,
) -> dict:
    policy = policy_from_config(user_config, timezone_name=timezone_name)
    zone = _safe_zoneinfo(policy.timezone)
    current = now or datetime.now(timezone.utc)
    local_now = (current if current.tzinfo else current.replace(tzinfo=timezone.utc)).astimezone(zone)
    current_logical = resolve_logical_date(
        local_now,
        day_rollover_time=policy.day_rollover_time,
        timezone_name=policy.timezone,
    )
    window_start = datetime.combine(
        current_logical,
        hhmm_to_time(policy.checkin_time, DEFAULT_CHECKIN_TIME),
        tzinfo=zone,
    )
    window_end = window_start + timedelta(minutes=policy.checkin_window_minutes)
    return {
        "is_open": window_start <= local_now <= window_end,
        "logical_date": current_logical,
        "current_logical_date": current_logical,
        "window_start": window_start,
        "window_end": window_end,
        "local_now": local_now,
        "policy": policy,
    }


def ensure_checkin_open(
    user_config: User_Configs | None,
    *,
    timezone_name: str | None = None,
    now: datetime | None = None,
) -> dict:
    state = checkin_window_state(user_config, timezone_name=timezone_name, now=now)
    if state["is_open"]:
        return state

    detail = (
        f"체크인은 {state['window_start'].strftime('%H:%M')}부터 "
        f"{state['window_end'].strftime('%H:%M')} 사이에 열려요."
    )
    raise HTTPException(status_code=403, detail=detail)
