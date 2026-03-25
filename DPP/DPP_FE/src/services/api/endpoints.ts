// API 경로 상수 — client.ts의 base URL에 붙는 path

export const ENDPOINTS = {
  /** 구현됨: POST /api/v1/auth/google-login */
  authGoogleLogin: "/api/v1/auth/google-login",

  /** 구현됨: POST /api/v1/logs */
  usageLogs: "/api/v1/logs",
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
  /** TODO: BE 미구현 */
  usersNickname: "/api/v1/users/nickname",
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
  /** TODO: BE 미구현 */
  appsInstalled: "/api/v1/apps/installed",
  /** TODO: BE 미구현 */
  dashboardToday: "/api/v1/dashboard/today",
  /** TODO: BE 미구현 */
  dashboardDailySummary: "/api/v1/dashboard/daily_summary",
  /** TODO: BE 미구현 */
  checkinStatsNight: "/api/v1/checkin/stats/night",
  /** TODO: BE 미구현 */
  checkinPatterns: "/api/v1/checkin/patterns",
  /** TODO: BE 미구현 */
  checkinSubmit: "/api/v1/checkin/submit",
  /** TODO: BE 미구현 */
  calendarSummary: "/api/v1/calendar/summary",
  /** TODO: BE 미구현 */
  reportDaily: "/api/v1/reports/daily",
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
