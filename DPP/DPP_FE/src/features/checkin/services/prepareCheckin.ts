import {
  generateCheckinPatterns,
  postDailySnapshotV3,
} from "../../../services/api/checkin.api";
import { DEV_RELAXED_MODE } from "../../../config/devMode";
import {
  buildSnapshotPayload,
  readLatestCompletedUsageStats,
} from "../../usage/services/dailyUsage";

export async function prepareCheckinPatterns(): Promise<void> {
  const { rows, unlockCount, logicalDate, capturedAt } =
    await readLatestCompletedUsageStats();
  const snapshot = buildSnapshotPayload(rows, unlockCount, {
    logicalDate,
    capturedAt,
  });
  const snapshotResult = await postDailySnapshotV3(snapshot);
  await generateCheckinPatterns({
    date: snapshotResult.snapshot_date,
    force_regenerate: DEV_RELAXED_MODE,
  });
}
