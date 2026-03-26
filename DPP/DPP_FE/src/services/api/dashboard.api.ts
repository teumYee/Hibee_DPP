// 대시보드 — 사용 로그 전송, 오늘 지표, AI 일일 요약, 설치 앱 분류
import { get, post, put } from "./client";
import { ENDPOINTS } from "./endpoints";

export type UsageLogItem = {
  user_id: number;
  package_name: string;
  app_name: string;
  usage_duration: number;
  date: string;
  start_time: string;
  end_time: string;
  unlock_count: number;
  category_id: number;
  is_night_mode: boolean;
  app_launch_count?: number;
  max_continuous_duration?: number;
};

export type PostUsageLogsRequest = {
  user_id: number;
  logs: UsageLogItem[];
  unlock_count: number;
};

export type InstalledApp = {
  packageName: string;
  appName: string;
  categoryId: number;
  categoryName: string;
  iconBase64?: string;
};

export type CategorySetupItem = {
  package_name: string;
  app_name: string;
  category_id: number;
  category_name: string;
};

export type PutUserCategorySetupRequest = {
  user_id: number;
  categories: CategorySetupItem[];
};

export type FrequentAppItem = {
  package_name: string;
  app_name: string;
  duration_seconds: number;
  rank?: number;
};

/** GET /dashboard/today — snake_case 서버 응답 */
export type DashboardToday = {
  total_usage_minutes: number;
  unlock_count: number;
  unlock_count_yesterday: number;
  most_used_app: { name: string; minutes: number };
  top_apps: { name: string; visit_count: number }[];
  max_continuous_minutes: number;
  max_continuous_start: string;
  max_continuous_end: string;
  session_count: number;
  yesterday_same_time_minutes: number;
};

export type GetDashboardDailySummaryResponse = {
  /** AI 생성 오늘 하루 요약 코멘트 */
  summary: string;
};

export async function postUsageLogs(
  body: PostUsageLogsRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.usageLogs, body);
}

export async function getDashboardToday(): Promise<DashboardToday> {
  return get<DashboardToday>(ENDPOINTS.dashboardToday);
}

export async function getDashboardDailySummary(): Promise<GetDashboardDailySummaryResponse> {
  return get<GetDashboardDailySummaryResponse>(ENDPOINTS.dashboardDailySummary);
}

export type InstalledAppPayload = {
  package_name: string;
  app_name: string;
};

export type PostAppsInstalledRequest = {
  apps: InstalledAppPayload[];
};

export type CategorizedAppItem = {
  id?: string;
  package_name: string;
  app_name: string;
};

export type ServerCategoryGroup = {
  id: string;
  name: string;
  icon?: string;
  apps: CategorizedAppItem[];
};

export type PostAppsInstalledResponse = {
  categories: ServerCategoryGroup[];
};

export async function postAppsInstalled(
  body: PostAppsInstalledRequest,
): Promise<PostAppsInstalledResponse> {
  return post<PostAppsInstalledResponse>(ENDPOINTS.appsInstalled, body);
}

export type PutUserCategoriesRequest = {
  assignments: { category_id: string; package_name: string }[];
};

export async function putUserCategories(
  body: PutUserCategoriesRequest,
): Promise<void> {
  await put<void>(ENDPOINTS.usersCategories, body);
}

export async function putUserCategorySetup(
  body: PutUserCategorySetupRequest,
): Promise<void> {
  await put<void>(ENDPOINTS.usersCategorySetup, body);
}
