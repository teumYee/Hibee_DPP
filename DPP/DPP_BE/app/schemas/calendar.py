from typing import List

from pydantic import BaseModel


class CalendarDayStatus(BaseModel):
    date: str
    week_start: str
    has_checkin: bool
    is_checkin_completed: bool
    has_daily_report: bool
    has_weekly_report: bool


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: List[CalendarDayStatus]
