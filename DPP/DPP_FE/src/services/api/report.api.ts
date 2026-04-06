// 리포트 — 일별·주별·캘린더 요약
import { get, HttpError, post } from "./client";
import type { CalendarDay, DailyReportData, WeeklyReportData } from "../../features/report/types";
import { ENDPOINTS } from "./endpoints";

type DailyReportApiResponse = {
  date: string;
  status: string;
  report_markdown?: string | null;
  report_text?: string | null;
  summary?: string | null;
  highlights: string[];
  recommendations: string[];
  chart_data: {
    total_usage_check: number;
    unlock_count: number;
    max_continuous_sec: number;
    app_launch_count: number;
    time_of_day_buckets: Record<string, number>;
  };
  evidence_refs: string[];
  issues: string[];
};

type ReportCheckinApiResponse = {
  checkin_id: number;
  date: string;
  selected_patterns: Array<Record<string, unknown>>;
  kpt_keep?: string | null;
  kpt_problem?: string | null;
  kpt_try?: string | null;
  is_completed: boolean;
};

type WeeklyReportApiResponse = {
  week_start: string;
  status: string;
  report_markdown?: string | null;
  report_text?: string | null;
  summary?: string | null;
  insights: string[];
  next_actions: string[];
  chart_data: {
    ai_score: number;
    checkin_count: number;
    total_usage_check: number;
    avg_daily_usage: number;
    avg_daily_unlock_count: number;
    total_app_launch_count: number;
    max_continuous_sec: number;
    time_of_day_buckets: Record<string, number>;
    daily_usage: Record<string, number>;
  };
  evidence_refs: string[];
  issues: string[];
};

type TimeBucketUiItem = {
  hour: number;
  label: string;
  color: string;
  minutes: number;
};

const TIME_BUCKET_META: Record<
  "morning" | "afternoon" | "evening" | "night",
  { hour: number; label: string; color: string }
> = {
  morning: { hour: 9, label: "아침", color: "#FFF8E7" },
  afternoon: { hour: 15, label: "낮", color: "#E8F4FC" },
  evening: { hour: 20, label: "저녁", color: "#FFE8DC" },
  night: { hour: 23, label: "밤", color: "#E8E8F0" },
};

function isNotFoundError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 404;
}

function splitNonEmptyLines(value: string | null | undefined): string[] {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapTimeBuckets(raw: Record<string, number> | undefined): TimeBucketUiItem[] {
  const buckets = raw || {};
  return (Object.keys(TIME_BUCKET_META) as Array<keyof typeof TIME_BUCKET_META>).map(
    (key) => ({
      hour: TIME_BUCKET_META[key].hour,
      label: TIME_BUCKET_META[key].label,
      color: TIME_BUCKET_META[key].color,
      minutes: Math.max(0, Math.round((Number(buckets[key]) || 0) / 60)),
    }),
  );
}

function buildDailyKptItems(
  checkin: ReportCheckinApiResponse | null,
): DailyReportData["kpt_items"] {
  if (!checkin) return [];

  return [
    ...splitNonEmptyLines(checkin.kpt_keep).map((label) => ({
      type: "keep" as const,
      label,
    })),
    ...splitNonEmptyLines(checkin.kpt_problem).map((label) => ({
      type: "problem" as const,
      label,
    })),
    ...splitNonEmptyLines(checkin.kpt_try).map((label) => ({
      type: "try" as const,
      label,
    })),
  ];
}

function buildDailyReportData(
  report: DailyReportApiResponse,
  checkin: ReportCheckinApiResponse | null,
): DailyReportData {
  const buckets = mapTimeBuckets(report.chart_data?.time_of_day_buckets);

  return {
    date: report.date,
    ai_summary:
      (report.summary || "").trim() ||
      report.highlights[0] ||
      "오늘 하루 리포트를 준비했어요.",
    time_buckets: buckets.map(({ hour, minutes }) => ({ hour, minutes })),
    category_usage: buckets.map(({ label, color, minutes }) => ({
      name: label,
      color,
      minutes,
    })),
    kpt_items: buildDailyKptItems(checkin),
    ai_comment:
      (report.report_text || "").trim() ||
      (report.summary || "").trim() ||
      [...report.highlights, ...report.recommendations].join("\n"),
  };
}

function parseMarkdownBullet(markdown: string | null | undefined, label: string): string {
  const text = String(markdown || "");
  const pattern = new RegExp(`-\\s*${label}:\\s*(.+)`);
  return text.match(pattern)?.[1]?.trim() || "";
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildWeeklyReportData(
  weekStart: string,
  report: WeeklyReportApiResponse,
): WeeklyReportData {
  const buckets = mapTimeBuckets(report.chart_data?.time_of_day_buckets);
  const mainActivityTime =
    parseMarkdownBullet(report.report_markdown, "주요 활동 시간대") || "데이터 없음";
  const bestDay =
    parseMarkdownBullet(report.report_markdown, "가장 안정적인 날") || "데이터 없음";
  const improveArea =
    report.next_actions[0] ||
    parseMarkdownBullet(report.report_markdown, "다음 주 집중 영역") ||
    "작은 습관 하나를 꾸준히 유지해 보세요.";

  return {
    week_id: weekStart,
    start_date: weekStart,
    end_date: addDays(weekStart, 6),
    ai_summary:
      (report.summary || "").trim() ||
      report.insights[0] ||
      "이번 주 리포트를 준비했어요.",
    avg_balance_score: Math.round(Number(report.chart_data?.ai_score || 0)),
    checkin_count: Number(report.chart_data?.checkin_count || 0),
    main_activity_time: mainActivityTime,
    best_day: bestDay,
    best_day_comment:
      report.insights.find((item) => item.includes(bestDay)) ||
      report.insights[2] ||
      report.summary ||
      "",
    improve_area: improveArea,
    improve_area_comment:
      report.next_actions[1] ||
      report.summary ||
      report.report_text ||
      "",
    badge: undefined,
    dolphin_observations:
      report.insights.length > 0 ? report.insights : [report.summary || "이번 주 관찰 내용이 없습니다."],
    next_week_suggestions:
      report.next_actions.length > 0
        ? report.next_actions
        : ["다음 주에도 같은 시간대 패턴을 비교해 보세요."],
    category_usage: buckets.map(({ label, color, minutes }) => ({
      name: label,
      color,
      minutes,
    })),
    ai_comment:
      (report.report_text || "").trim() ||
      (report.summary || "").trim() ||
      [...report.insights, ...report.next_actions].join("\n"),
  };
}

async function fetchDailyCheckin(date: string): Promise<ReportCheckinApiResponse | null> {
  try {
    return await get<ReportCheckinApiResponse>(ENDPOINTS.reportCheckins, { date });
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
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

export async function getDailyReportByDate(date: string): Promise<DailyReportData> {
  let report: DailyReportApiResponse;
  try {
    report = await get<DailyReportApiResponse>(ENDPOINTS.reportDaily, { date });
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error("이 날짜에는 아직 데일리 리포트가 없어요.\n체크인을 완료한 날의 리포트를 확인해보세요.");
    }
    throw error;
  }
  const checkin = await fetchDailyCheckin(date);
  return buildDailyReportData(report, checkin);
}

export async function ensureDailyReportByDate(date: string): Promise<DailyReportData> {
  // 테스트 모드: 기존 리포트가 있어도 매번 다시 생성해본다.
  const report = await post<DailyReportApiResponse>(ENDPOINTS.reportDailyGenerate, {
    date,
    force_regenerate: true,
  });
  const checkin = await fetchDailyCheckin(date);
  return buildDailyReportData(report, checkin);
}

export async function getWeeklyReport(weekStart: string): Promise<WeeklyReportData> {
  try {
    const report = await get<WeeklyReportApiResponse>(ENDPOINTS.reportWeekly, {
      week_start: weekStart,
    });
    return buildWeeklyReportData(weekStart, report);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error("이 주차에는 아직 주간 리포트가 없어요.\n먼저 해당 주의 체크인과 일간 리포트가 쌓여야 해요.");
    }
    throw error;
  }
}
