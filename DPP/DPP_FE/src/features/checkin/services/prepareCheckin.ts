import { NativeModules } from "react-native";
import {
  generateCheckinPatterns,
  postDailySnapshotV3,
  type PostDailySnapshotV3Request,
} from "../../../services/api/checkin.api";
import { useAuthStore } from "../../../store/auth.store";
import { getLogicalDate } from "../utils/checkinPolicy";

type UsageRow = {
  packageName: string;
  appName?: string;
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

type TimeBucketKey = "morning" | "afternoon" | "evening" | "night";
type TimelineBucketKey = "00-04" | "04-08" | "08-12" | "12-16" | "16-20" | "20-24";

function getUsageStatsModule(): UsageStatsModuleType | undefined {
  const { UsageStatsModule } = NativeModules as {
    UsageStatsModule?: UsageStatsModuleType;
  };
  return UsageStatsModule;
}

function emptyBuckets(): Record<TimeBucketKey, number> {
  return {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };
}

function emptyTimelineBuckets(): Record<TimelineBucketKey, number> {
  return {
    "00-04": 0,
    "04-08": 0,
    "08-12": 0,
    "12-16": 0,
    "16-20": 0,
    "20-24": 0,
  };
}

function toCategoryName(categoryId: number | undefined): string {
  switch (categoryId) {
    case 0:
      return "게임";
    case 1:
      return "오디오";
    case 2:
      return "비디오";
    case 3:
      return "이미지";
    case 4:
      return "소셜";
    case 5:
      return "뉴스";
    case 6:
      return "지도";
    case 7:
      return "생산성";
    default:
      return "미분류";
  }
}

function bucketKeyForHour(hour: number): TimeBucketKey {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

function timelineKeyForHour(hour: number): TimelineBucketKey {
  if (hour < 4) return "00-04";
  if (hour < 8) return "04-08";
  if (hour < 12) return "08-12";
  if (hour < 16) return "12-16";
  if (hour < 20) return "16-20";
  return "20-24";
}

function addDurationByLocalSpan(
  target: Record<string, number>,
  row: UsageRow,
  usageSeconds: number,
  keyForHour: (hour: number) => string,
): void {
  const startMs = Math.max(0, Math.round(row.firstTimeStamp || 0));
  const lastMs = Math.max(startMs, Math.round(row.lastTimeStamp || 0));
  const approxSpanMs = Math.max(lastMs - startMs, usageSeconds * 1000);

  if (approxSpanMs <= 0) {
    target[keyForHour(new Date(startMs || Date.now()).getHours())] += usageSeconds;
    return;
  }

  const rangeStart = startMs || Math.max(0, lastMs - approxSpanMs);
  const rangeEnd = rangeStart + approxSpanMs;
  const allocated: Array<{ key: string; overlapMs: number }> = [];
  let cursor = new Date(rangeStart);
  cursor.setMinutes(0, 0, 0);

  while (cursor.getTime() < rangeEnd) {
    const next = new Date(cursor);
    next.setHours(cursor.getHours() + 1, 0, 0, 0);
    const overlapStart = Math.max(rangeStart, cursor.getTime());
    const overlapEnd = Math.min(rangeEnd, next.getTime());
    if (overlapEnd > overlapStart) {
      allocated.push({
        key: keyForHour(cursor.getHours()),
        overlapMs: overlapEnd - overlapStart,
      });
    }
    cursor = next;
  }

  if (allocated.length === 0) {
    target[keyForHour(new Date(rangeStart).getHours())] += usageSeconds;
    return;
  }

  const totalOverlapMs = allocated.reduce((sum, item) => sum + item.overlapMs, 0);
  let remaining = usageSeconds;
  allocated.forEach((item, index) => {
    const portion =
      index === allocated.length - 1
        ? remaining
        : Math.max(0, Math.round((usageSeconds * item.overlapMs) / totalOverlapMs));
    target[item.key] = (target[item.key] || 0) + portion;
    remaining -= portion;
  });
}

function buildSnapshotPayload(
  rows: UsageRow[],
  unlockCount: number,
): PostDailySnapshotV3Request {
  const buckets = emptyBuckets();
  const timelineBuckets = emptyTimelineBuckets();
  let totalUsageSeconds = 0;
  let totalLaunchCount = 0;
  let maxContinuousSeconds = 0;
  const categoryMeta = new Map(
    useAuthStore
      .getState()
      .onboardingData.categories.map((item) => [item.packageName, item]),
  );
  const perApp = rows
    .map((row) => {
      const usageSeconds = Math.max(0, Math.round(row.usageTime || 0));
      const launchCount = Math.max(0, Math.round(row.appLaunchCount || 0));
      const maxContinuous = Math.max(0, Math.round(row.maxContinuousTime || 0));
      const matchedCategory = categoryMeta.get(row.packageName);
      const categoryId = matchedCategory?.categoryId ?? row.category ?? -1;
      const categoryName = matchedCategory?.categoryName ?? toCategoryName(categoryId);
      const appName = matchedCategory?.appName ?? row.appName ?? row.packageName;

      totalUsageSeconds += usageSeconds;
      totalLaunchCount += launchCount;
      maxContinuousSeconds = Math.max(maxContinuousSeconds, maxContinuous);
      addDurationByLocalSpan(buckets, row, usageSeconds, bucketKeyForHour);
      addDurationByLocalSpan(timelineBuckets, row, usageSeconds, timelineKeyForHour);

      return {
        package_name: row.packageName,
        app_name: appName,
        usage_sec: usageSeconds,
        launch_count: launchCount,
        max_continuous_sec: maxContinuous,
        first_seen_at:
          row.firstTimeStamp > 0 ? new Date(row.firstTimeStamp).toISOString() : null,
        last_seen_at:
          row.lastTimeStamp > 0 ? new Date(row.lastTimeStamp).toISOString() : null,
        category: categoryName,
        category_id: categoryId,
      };
    })
    .filter((row) => row.usage_sec > 0);

  const perCategoryMap = new Map<
    string,
    { category: string; usage_sec: number; app_count: number; launch_count: number }
  >();

  for (const item of perApp) {
    const key = item.category || "미분류";
    const current = perCategoryMap.get(key) ?? {
      category: key,
      usage_sec: 0,
      app_count: 0,
      launch_count: 0,
    };
    current.usage_sec += item.usage_sec;
    current.app_count += 1;
    current.launch_count += item.launch_count;
    perCategoryMap.set(key, current);
  }

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  const now = new Date();
  const logicalDate = getLogicalDate(now);

  return {
    date: logicalDate,
    timezone,
    captured_at: now.toISOString(),
    total_usage_check: totalUsageSeconds,
    unlock_count: Math.max(0, Math.round(unlockCount || 0)),
    time_of_day_buckets_sec: buckets,
    max_continuous_sec: maxContinuousSeconds,
    app_launch_count: totalLaunchCount,
    per_app_usage_json: perApp,
    per_category_usage_json: [...perCategoryMap.values()].sort(
      (a, b) => b.usage_sec - a.usage_sec,
    ),
    timeline_buckets_json: timelineBuckets,
    top_apps_json: [...perApp].sort((a, b) => b.usage_sec - a.usage_sec).slice(0, 5),
    package_name: "__all__",
    schema_version: "2.0.0",
  };
}

export async function prepareCheckinPatterns(): Promise<void> {
  const mod = getUsageStatsModule();
  if (!mod) {
    throw new Error("UsageStatsModule을 찾을 수 없어요.");
  }

  const hasPermission = await mod.checkPermission();
  if (!hasPermission) {
    throw new Error("사용 기록 접근 권한이 필요해요.");
  }

  const [rawRows, unlockCount] = await Promise.all([
    mod.getTodayUsage(),
    mod.getUnlockCount(),
  ]);

  const rows = Array.isArray(rawRows) ? rawRows : [];
  const snapshot = buildSnapshotPayload(rows, unlockCount);

  const snapshotResult = await postDailySnapshotV3(snapshot);
  // 테스트 모드: 패턴 후보를 매번 다시 생성한다.
  await generateCheckinPatterns({
    date: snapshotResult.snapshot_date,
    force_regenerate: true,
  });
}
