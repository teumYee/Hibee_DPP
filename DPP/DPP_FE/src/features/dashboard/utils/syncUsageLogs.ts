import type { PostUsageLogsRequest } from "../../../services/api/dashboard.api";
import { postDailySnapshotV3 } from "../../../services/api/checkin.api";
import { postUsageLogs } from "../../../services/api/dashboard.api";
import { useAuthStore } from "../../../store/auth.store";
import {
  buildSnapshotPayload,
  buildUsageLogsPayload,
  readTodayUsageStats,
} from "../../usage/services/dailyUsage";

function logPostUsageLogsPayload(payload: PostUsageLogsRequest, label: string): void {
  const perLog = payload.logs.map((log, i) => ({
    i,
    package_name: log.package_name,
    usage_duration: log.usage_duration,
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

/** 화면 진입 시 사용 통계를 서버로 전송 (POST /usage/logs) */
export async function syncUsageLogsOnDashboardEnter(): Promise<void> {
  const userId = useAuthStore.getState().userId;
  if (userId == null) {
    return;
  }
  try {
    const { rows, unlockCount } = await readTodayUsageStats();
    const payload = buildUsageLogsPayload(rows, unlockCount, userId);
    logPostUsageLogsPayload(payload, "full sync");
    await postUsageLogs(payload);
    await postDailySnapshotV3(buildSnapshotPayload(rows, unlockCount));
  } catch (error) {
    console.warn("[syncUsageLogs] skipped", error);
  }
}
