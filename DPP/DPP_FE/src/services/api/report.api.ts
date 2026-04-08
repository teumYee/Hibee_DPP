// 리포트 — 일별·주별·캘린더 요약
import { get, HttpError, post } from "./client";
import { DEV_RELAXED_MODE } from "../../config/devMode";
import type {
  CalendarDay,
  DailyReportData,
  ReportMetric,
  ReportTopAppItem,
  ReportTrendPoint,
  ReportUsageItem,
  WeeklyReportData,
} from "../../features/report/types";
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
    timeline_buckets: Record<string, number>;
    top_apps: Array<{
      package_name: string;
      app_name: string;
      usage_sec: number;
      launch_count: number;
      max_continuous_sec: number;
      category?: string | null;
    }>;
    per_category_usage: Array<{
      category: string;
      usage_sec: number;
      app_count: number;
      launch_count: number;
    }>;
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
    top_apps: Array<{
      package_name: string;
      app_name: string;
      usage_sec: number;
      launch_count: number;
      max_continuous_sec: number;
      category?: string | null;
    }>;
    per_category_usage: Array<{
      category: string;
      usage_sec: number;
      app_count: number;
      launch_count: number;
    }>;
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

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

const TIME_BUCKET_META: Record<
  "morning" | "afternoon" | "evening" | "night",
  { hour: number; label: string; color: string }
> = {
  morning: { hour: 9, label: "아침", color: "#FFF8E7" },
  afternoon: { hour: 15, label: "낮", color: "#E8F4FC" },
  evening: { hour: 20, label: "저녁", color: "#FFE8DC" },
  night: { hour: 23, label: "밤", color: "#E8E8F0" },
};

const TIMELINE_BUCKET_META: Record<
  "00-04" | "04-08" | "08-12" | "12-16" | "16-20" | "20-24",
  { label: string; color: string }
> = {
  "00-04": { label: "00-04", color: "#D8DCEE" },
  "04-08": { label: "04-08", color: "#EDE7FA" },
  "08-12": { label: "08-12", color: "#FFF1C9" },
  "12-16": { label: "12-16", color: "#DDF0FF" },
  "16-20": { label: "16-20", color: "#FFDCC9" },
  "20-24": { label: "20-24", color: "#CFE2F8" },
};

const CATEGORY_COLORS = [
  "#2E7FC1",
  "#FFB347",
  "#8A6FE8",
  "#1D9E75",
  "#E85D24",
  "#4AA3A2",
];

function isNotFoundError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 404;
}

function splitNonEmptyLines(value: string | null | undefined): string[] {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toMinutes(seconds: number | null | undefined): number {
  return Math.max(0, Math.round((Number(seconds) || 0) / 60));
}

function formatMetricHelper(minutes: number): string {
  if (minutes <= 0) return "0분";
  if (minutes < 60) return `${minutes}분`;
  const hour = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hour}시간` : `${hour}시간 ${rest}분`;
}

function colorByIndex(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
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

function mapTimelineBuckets(raw: Record<string, number> | undefined): ReportUsageItem[] {
  const timeline = raw || {};
  return (
    Object.keys(TIMELINE_BUCKET_META) as Array<keyof typeof TIMELINE_BUCKET_META>
  ).map((key, index) => ({
    name: TIMELINE_BUCKET_META[key].label,
    color: TIMELINE_BUCKET_META[key].color || colorByIndex(index),
    minutes: toMinutes(Number(timeline[key]) || 0),
  }));
}

function mapTopApps(
  raw: WeeklyReportApiResponse["chart_data"]["top_apps"] | DailyReportApiResponse["chart_data"]["top_apps"] | undefined,
): ReportTopAppItem[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      name: item.app_name || item.package_name || "알 수 없는 앱",
      minutes: toMinutes(item.usage_sec),
      launch_count: Math.max(0, Number(item.launch_count) || 0),
      category: item.category || undefined,
    }))
    .filter((item) => item.minutes > 0 || item.launch_count > 0)
    .sort((a, b) => b.minutes - a.minutes || b.launch_count - a.launch_count)
    .slice(0, 5);
}

function mapCategoryUsage(
  raw: WeeklyReportApiResponse["chart_data"]["per_category_usage"] | DailyReportApiResponse["chart_data"]["per_category_usage"] | undefined,
): ReportUsageItem[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item, index) => ({
      name: item.category || "미분류",
      minutes: toMinutes(item.usage_sec),
      app_count: Math.max(0, Number(item.app_count) || 0),
      launch_count: Math.max(0, Number(item.launch_count) || 0),
      color: colorByIndex(index),
    }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || (b.launch_count || 0) - (a.launch_count || 0));
}

function mapMetrics(raw: Array<{
  label: string;
  value: number;
  unit?: string;
  helper?: string;
}>): ReportMetric[] {
  return raw.map((item) => ({
    label: item.label,
    value: Math.max(0, Number(item.value) || 0),
    unit: item.unit,
    helper: item.helper,
  }));
}

function mapDailyUsageTrend(raw: Record<string, number> | undefined): ReportTrendPoint[] {
  return Object.entries(raw || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const date = new Date(`${key}T00:00:00`);
      const weekday = WEEKDAYS_KO[date.getDay()] || "";
      return {
        key,
        label: `${date.getMonth() + 1}/${date.getDate()} ${weekday}`,
        minutes: toMinutes(value),
      };
    });
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
  const totalUsageMinutes = toMinutes(report.chart_data?.total_usage_check);
  const maxContinuousMinutes = toMinutes(report.chart_data?.max_continuous_sec);
  const topApps = mapTopApps(report.chart_data?.top_apps);
  const categoryUsage = mapCategoryUsage(report.chart_data?.per_category_usage);
  const timelineUsage = mapTimelineBuckets(report.chart_data?.timeline_buckets);

  return {
    date: report.date,
    ai_summary:
      (report.summary || "").trim() ||
      report.highlights[0] ||
      "오늘 하루 리포트를 준비했어요.",
    metrics: mapMetrics([
      {
        label: "총 사용",
        value: totalUsageMinutes,
        unit: "분",
        helper: formatMetricHelper(totalUsageMinutes),
      },
      {
        label: "언락",
        value: Number(report.chart_data?.unlock_count || 0),
        unit: "회",
      },
      {
        label: "최장 연속",
        value: maxContinuousMinutes,
        unit: "분",
        helper: formatMetricHelper(maxContinuousMinutes),
      },
      {
        label: "앱 실행",
        value: Number(report.chart_data?.app_launch_count || 0),
        unit: "회",
      },
    ]),
    time_buckets: buckets.map(({ hour, minutes }) => ({ hour, minutes })),
    time_of_day_usage: buckets.map(({ label, color, minutes }) => ({
      name: label,
      color,
      minutes,
    })),
    category_usage: categoryUsage,
    timeline_usage: timelineUsage,
    top_apps: topApps,
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
  const totalUsageMinutes = toMinutes(report.chart_data?.total_usage_check);
  const avgDailyUsageMinutes = toMinutes(report.chart_data?.avg_daily_usage);
  const maxContinuousMinutes = toMinutes(report.chart_data?.max_continuous_sec);
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
    metrics: mapMetrics([
      {
        label: "주간 총 사용",
        value: totalUsageMinutes,
        unit: "분",
        helper: formatMetricHelper(totalUsageMinutes),
      },
      {
        label: "일평균 사용",
        value: avgDailyUsageMinutes,
        unit: "분",
        helper: formatMetricHelper(avgDailyUsageMinutes),
      },
      {
        label: "평균 언락",
        value: Number(report.chart_data?.avg_daily_unlock_count || 0),
        unit: "회",
      },
      {
        label: "앱 실행",
        value: Number(report.chart_data?.total_app_launch_count || 0),
        unit: "회",
      },
      {
        label: "최장 연속",
        value: maxContinuousMinutes,
        unit: "분",
        helper: formatMetricHelper(maxContinuousMinutes),
      },
    ]),
    daily_usage: mapDailyUsageTrend(report.chart_data?.daily_usage),
    time_of_day_usage: buckets.map(({ label, color, minutes }) => ({
      name: label,
      color,
      minutes,
    })),
    top_apps: mapTopApps(report.chart_data?.top_apps),
    dolphin_observations:
      report.insights.length > 0 ? report.insights : [report.summary || "이번 주 관찰 내용이 없습니다."],
    next_week_suggestions:
      report.next_actions.length > 0
        ? report.next_actions
        : ["다음 주에도 같은 시간대 패턴을 비교해 보세요."],
    category_usage: mapCategoryUsage(report.chart_data?.per_category_usage),
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
