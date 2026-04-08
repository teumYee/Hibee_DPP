export type ReportMetric = {
  label: string;
  value: number;
  unit?: string;
  helper?: string;
};

export type ReportUsageItem = {
  name: string;
  minutes: number;
  color: string;
  app_count?: number;
  launch_count?: number;
};

export type ReportTopAppItem = {
  name: string;
  minutes: number;
  launch_count: number;
  category?: string;
};

export type ReportTrendPoint = {
  key: string;
  label: string;
  minutes: number;
};

export type DailyReportData = {
  date: string;
  ai_summary: string;
  metrics: ReportMetric[];
  time_buckets: { hour: number; minutes: number }[];
  time_of_day_usage: ReportUsageItem[];
  category_usage: ReportUsageItem[];
  timeline_usage: ReportUsageItem[];
  top_apps: ReportTopAppItem[];
  kpt_items: { type: "keep" | "problem" | "try"; label: string }[];
  ai_comment: string;
};

export type WeeklyReportData = {
  week_id: string;
  start_date: string;
  end_date: string;
  ai_summary: string;
  avg_balance_score: number;
  checkin_count: number;
  main_activity_time: string;
  best_day: string;
  best_day_comment: string;
  improve_area: string;
  improve_area_comment: string;
  badge?: string;
  metrics: ReportMetric[];
  daily_usage: ReportTrendPoint[];
  time_of_day_usage: ReportUsageItem[];
  top_apps: ReportTopAppItem[];
  dolphin_observations: string[];
  next_week_suggestions: string[];
  category_usage: ReportUsageItem[];
  ai_comment: string;
};

export type CalendarDay = {
  date: string;
  has_daily_report: boolean;
  has_weekly_report: boolean;
};
