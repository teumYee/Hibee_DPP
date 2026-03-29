from calendar import monthrange
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.calendar import CheckIn
from app.models.reports import DailyReports, WeeklyReports
from app.models.user import Users
from app.schemas.calendar import CalendarDayStatus, CalendarMonthResponse

router = APIRouter()


@router.get("/month", response_model=CalendarMonthResponse)
def get_calendar_month(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    if month == 12:
        next_month_start = date(year + 1, 1, 1)
    else:
        next_month_start = date(year, month + 1, 1)

    weekly_range_start = first_day - timedelta(days=first_day.weekday())
    weekly_range_end = last_day - timedelta(days=last_day.weekday())

    checkin_rows = db.query(CheckIn).filter(
        CheckIn.user_id == current_user.id,
        CheckIn.date >= first_day,
        CheckIn.date <= last_day,
    ).all()
    daily_report_rows = db.query(DailyReports).filter(
        DailyReports.user_id == current_user.id,
        DailyReports.date >= datetime.combine(first_day, datetime.min.time()),
        DailyReports.date < datetime.combine(next_month_start, datetime.min.time()),
    ).all()
    weekly_report_rows = db.query(WeeklyReports).filter(
        WeeklyReports.user_id == current_user.id,
        WeeklyReports.date_week >= weekly_range_start.isoformat(),
        WeeklyReports.date_week <= weekly_range_end.isoformat(),
    ).all()

    checkin_map = {row.date: row for row in checkin_rows if row.date}
    daily_report_dates = {row.date.date() for row in daily_report_rows if row.date}
    weekly_report_weeks = {row.date_week for row in weekly_report_rows if row.date_week}

    days = []
    for day in range(1, last_day.day + 1):
        target_date = date(year, month, day)
        week_start = target_date - timedelta(days=target_date.weekday())
        checkin = checkin_map.get(target_date)
        days.append(
            CalendarDayStatus(
                date=target_date.isoformat(),
                week_start=week_start.isoformat(),
                has_checkin=checkin is not None,
                is_checkin_completed=bool(checkin.is_completed) if checkin else False,
                has_daily_report=target_date in daily_report_dates,
                has_weekly_report=week_start.isoformat() in weekly_report_weeks,
            )
        )

    return CalendarMonthResponse(year=year, month=month, days=days)
