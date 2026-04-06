// API 경로 상수 — client.ts의 base URL에 붙는 path

export const ENDPOINTS = {
  /** 구현됨: POST /api/v1/auth/google-login */
  authGoogleLogin: "/api/v1/auth/google-login",

  /** 구현됨: POST /api/v1/logs */
  usageLogs: "/api/v1/logs",
  /** 구현됨: POST /api/v1/logs/snapshots/v3 */
  usageLogsSnapshotsV3: "/api/v1/logs/snapshots/v3",
  /** 구현됨: GET /api/v1/logs/{user_id} */
  usageLogsByUser: "/api/v1/logs",

  /** 구현됨: GET /api/v1/dashboard/dashboard/summary/{user_id} */
  dashboardSummary: "/api/v1/dashboard/dashboard/summary",

  /** TODO: BE 미구현 */
  usersMeSummary: "/api/v1/users/me/summary",
  /** TODO: BE 미구현 */
  userLevel: "/api/v1/users/me/level",
  /** TODO: BE 미구현 */
  userAchievements: "/api/v1/users/me/achievements",
  /** 구현됨: POST /api/v1/users/nickname */
  usersNickname: "/api/v1/users/nickname",
  /** 구현됨: POST /api/v1/users/onboarding */
  usersOnboarding: "/api/v1/users/onboarding",
  /** TODO: BE 미구현 */
  usersGoalsPatterns: "/api/v1/users/goals/patterns",
  /** TODO: BE 미구현 */
  settingsWeeklyGoal: "/api/v1/users/settings/weekly-goal",
  /** TODO: BE 미구현 */
  settingsNightMode: "/api/v1/users/settings/night-mode",
  /** TODO: BE 미구현 */
  settingsActiveTime: "/api/v1/users/settings/active-time",
  /** TODO: BE 미구현 */
  settingsCategories: "/api/v1/users/settings/categories",
  /** TODO: BE 미구현 */
  settingsAccount: "/api/v1/users/settings/account",
  /** TODO: BE 미구현 */
  deleteUserData: "/api/v1/users/me/data",
  /** TODO: BE 미구현 */
  deleteUser: "/api/v1/users/me",
  /** TODO: BE 미구현 */
  usersSettingsActiveTime: "/api/v1/users/settings/active_time",
  /** TODO: BE 미구현 */
  usersSettingsNightTime: "/api/v1/users/settings/night_time",
  /** TODO: BE 미구현 */
  usersGoalsStruggles: "/api/v1/users/goals/struggles",
  /** TODO: BE 미구현 */
  usersGoalsFocusCategory: "/api/v1/users/goals/focus_category",
  /** TODO: BE 미구현 */
  usersCategories: "/api/v1/users/categories",
  /** 구현됨: PUT /api/v1/users/category-setup */
  usersCategorySetup: "/api/v1/users/category-setup",
  /** TODO: BE 미구현 */
  appsInstalled: "/api/v1/apps/installed",
  /** TODO: BE 미구현 */
  dashboardToday: "/api/v1/dashboard/today",
  /** TODO: BE 미구현 */
  dashboardDailySummary: "/api/v1/dashboard/daily_summary",
  /** 구현됨: GET /api/v1/checkin/stats/night */
  checkinStatsNight: "/api/v1/checkin/stats/night",
  /** 구현됨: GET /api/v1/checkin/patterns */
  checkinPatterns: "/api/v1/checkin/patterns",
  /** 구현됨: POST /api/v1/checkin/submit */
  checkinSubmit: "/api/v1/checkin/submit",
  /** 구현됨: POST /api/v1/reports/pattern-candidates/generate */
  reportPatternCandidatesGenerate: "/api/v1/reports/pattern-candidates/generate",
  /** TODO: BE 미구현 */
  calendarSummary: "/api/v1/calendar/summary",
  /** 구현됨: GET /api/v1/reports/daily?date=YYYY-MM-DD */
  reportDaily: "/api/v1/reports/daily",
  /** 구현됨: POST /api/v1/reports/daily/generate */
  reportDailyGenerate: "/api/v1/reports/daily/generate",
  /** 구현됨: GET /api/v1/reports/weekly?week_start=YYYY-MM-DD */
  reportWeekly: "/api/v1/reports/weekly",
  /** 구현됨: POST /api/v1/reports/weekly/generate */
  reportWeeklyGenerate: "/api/v1/reports/weekly/generate",
  /** 구현됨: GET /api/v1/reports/checkins?date=YYYY-MM-DD */
  reportCheckins: "/api/v1/reports/checkins",
  /** TODO: BE 미구현 */
  storeInventory: "/api/v1/store/inventory",
  /** TODO: BE 미구현 */
  storeItems: "/api/v1/store/items",
  /** TODO: BE 미구현 */
  storePurchase: "/api/v1/store/purchase",
  /** TODO: BE 미구현 */
  socialSearch: "/api/v1/social/search",
  /** TODO: BE 미구현 */
  socialFriends: "/api/v1/social/friends",
} as const;

export function socialFriendCheerPath(id: string): string {
  // TODO: BE 미구현
  return `/api/v1/social/friends/${encodeURIComponent(id)}/cheer`;
}

export function socialFriendDeletePath(id: string): string {
  // TODO: BE 미구현
  return `/api/v1/social/friends/${encodeURIComponent(id)}`;
}

export function userProfilePath(id: string): string {
  // TODO: BE 미구현
  return `/api/v1/users/${encodeURIComponent(id)}/profile`;
}

export function reportWeeklyPath(weekId: string): string {
  // TODO: BE 미구현
  return `/api/v1/reports/weekly/${encodeURIComponent(weekId)}`;
}

export function reportDailyPath(reportId: string): string {
  // TODO: BE 미구현
  return `/api/v1/reports/daily/${encodeURIComponent(reportId)}/daily`;
}
