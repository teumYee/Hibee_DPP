export type DailyReportData = {
  date: string;
  ai_summary: string;
  time_buckets: { hour: number; minutes: number }[];
  category_usage: { name: string; minutes: number; color: string }[];
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
  dolphin_observations: string[];
  next_week_suggestions: string[];
  category_usage: { name: string; minutes: number; color: string }[];
  ai_comment: string;
};

export type CalendarDay = {
  date: string;
  has_daily_report: boolean;
  has_weekly_report: boolean;
};
