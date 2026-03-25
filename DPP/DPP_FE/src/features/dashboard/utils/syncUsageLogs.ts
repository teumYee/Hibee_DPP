import { NativeModules } from "react-native";
import type { PostUsageLogsRequest, UsageLogItem } from "../../../services/api/dashboard.api";
import { postUsageLogs } from "../../../services/api/dashboard.api";

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

function rowsToLogs(rows: UsageRow[]): UsageLogItem[] {
  return rows.map((r) => ({
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
  const mod = getModule();
  const empty: PostUsageLogsRequest = { logs: [], unlock_count: 0 };
  if (!mod) {
    await postUsageLogs(empty);
    return;
  }
  try {
    const ok = await mod.checkPermission();
    if (!ok) {
      await postUsageLogs(empty);
      return;
    }
    const [raw, unlockCount] = await Promise.all([
      mod.getTodayUsage(),
      mod.getUnlockCount(),
    ]);
    const rows = Array.isArray(raw) ? raw : [];
    const payload: PostUsageLogsRequest = {
      logs: rowsToLogs(rows),
      unlock_count: typeof unlockCount === "number" ? unlockCount : 0,
    };
    await postUsageLogs(payload);
  } catch {
    await postUsageLogs(empty);
  }
}
