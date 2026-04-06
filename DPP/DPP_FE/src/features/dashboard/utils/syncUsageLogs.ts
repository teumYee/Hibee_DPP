import { NativeModules } from "react-native";
import type { PostUsageLogsRequest, UsageLogItem } from "../../../services/api/dashboard.api";
import { postUsageLogs } from "../../../services/api/dashboard.api";
import { useAuthStore } from "../../../store/auth.store";

type UsageRow = {
  packageName: string;
  appName: string;
  usageTime: number;
  firstTimeStamp: number;
  lastTimeStamp: number;
  category?: number;
  appLaunchCount: number;
  maxContinuousTime: number;
};

type UsageStatsModuleType = {
  checkPermission: () => Promise<boolean>;
  getTodayUsage: () => Promise<UsageRow[]>;
  getUnlockCount: () => Promise<number>;
};

function getModule(): UsageStatsModuleType | undefined {
  const { UsageStatsModule } = NativeModules as {
    UsageStatsModule?: UsageStatsModuleType;
  };
  return UsageStatsModule;
}

function logPostUsageLogsPayload(payload: PostUsageLogsRequest, label: string): void {
  const perLog = payload.logs.map((log, i) => ({
    i,
    package_name: log.package_name,
    app_launch_count: log.app_launch_count,
    max_continuous_duration: log.max_continuous_duration,
  }));
  console.log(`[syncUsageLogs] ${label}`, {
    user_id: payload.user_id,
    unlock_count: payload.unlock_count,
    logsCount: payload.logs.length,
    perLog,
  });
}

function rowsToLogs(rows: UsageRow[], userId: number): UsageLogItem[] {
  return rows.map((r) => ({
    user_id: userId,
    package_name: r.packageName,
    app_name: r.appName || "Unknown",
    usage_duration: Math.round(r.usageTime),
    date: new Date(r.firstTimeStamp).toISOString(),
    start_time: new Date(r.firstTimeStamp).toISOString(),
    end_time: new Date(r.lastTimeStamp).toISOString(),
    unlock_count: 0,
    category_id: r.category ?? -1,
    is_night_mode: false,
    app_launch_count: r.appLaunchCount,
    max_continuous_duration: Math.round(r.maxContinuousTime),
  }));
}

/** 화면 진입 시 사용 통계를 서버로 전송 (POST /usage/logs) */
export async function syncUsageLogsOnDashboardEnter(): Promise<void> {
  const userId = useAuthStore.getState().userId;
  if (userId == null) {
    return;
  }
  const mod = getModule();
  const empty: PostUsageLogsRequest = { user_id: userId, logs: [], unlock_count: 0 };
  if (!mod) {
    logPostUsageLogsPayload(empty, "no native module");
    await postUsageLogs(empty);
    return;
  }
  try {
    const ok = await mod.checkPermission();
    if (!ok) {
      logPostUsageLogsPayload(empty, "usage permission denied");
      await postUsageLogs(empty);
      return;
    }
    const [raw, unlockCount] = await Promise.all([
      mod.getTodayUsage(),
      mod.getUnlockCount(),
    ]);
    const rows = Array.isArray(raw) ? raw : [];
    const payload: PostUsageLogsRequest = {
      user_id: userId,
      logs: rowsToLogs(rows, userId),
      unlock_count: typeof unlockCount === "number" ? unlockCount : 0,
    };
    logPostUsageLogsPayload(payload, "full sync");
    await postUsageLogs(payload);
  } catch {
    logPostUsageLogsPayload(empty, "catch → empty");
    await postUsageLogs(empty);
  }
}
