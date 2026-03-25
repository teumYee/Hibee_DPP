// 리포트 — 일별·주별·캘린더 요약
import { get } from "./client";
import type { CalendarDay, DailyReportData, WeeklyReportData } from "../../features/report/types";
import { ENDPOINTS, reportDailyPath, reportWeeklyPath } from "./endpoints";

export type HourlyUsageItem = {
  hour: number;
  usage_seconds: number;
};

export type CategoryUsageItem = {
  category: string;
  usage_seconds: number;
};

export type GetReportDailyResponse = {
  hourly_usage: HourlyUsageItem[];
  category_usage: CategoryUsageItem[];
  ai_comment: string;
};

export async function getReportDaily(
  reportId: string,
  date: string,
): Promise<GetReportDailyResponse> {
  return get<GetReportDailyResponse>(reportDailyPath(reportId), {
    date,
  });
}

/**
 * TODO: GET /calendar/summary?year=N&month=N
 * 응답 형태 확정 후 `CalendarDay[]` 매핑.
 */
export async function getCalendarSummary(
  year: number,
  month: number,
): Promise<CalendarDay[]> {
  return get<CalendarDay[]>(ENDPOINTS.calendarSummary, { year, month });
}

/**
 * TODO: GET /reports/daily?date=YYYY-MM-DD
 */
export async function getDailyReportByDate(date: string): Promise<DailyReportData> {
  return get<DailyReportData>(ENDPOINTS.reportDaily, { date });
}

/**
 * TODO: GET /reports/weekly/{id}
 */
export async function getWeeklyReport(weekId: string): Promise<WeeklyReportData> {
  return get<WeeklyReportData>(reportWeeklyPath(weekId));
}
