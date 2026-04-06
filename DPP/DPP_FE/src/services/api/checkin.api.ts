// 체크인 — 야간 통계, 패턴 후보, 제출
import type { CheckinPattern } from "../../features/checkin/types";
import { get, post } from "./client";
import { ENDPOINTS } from "./endpoints";

export type GetCheckinNightStatsResponse = {
  night_usage_seconds: number;
};

export type GetCheckinPatternsResponse = {
  patterns: CheckinPattern[];
};

export type PostCheckinSubmitRequest = {
  pattern_ids: [string, string, string];
  kpt_tags: string[];
};

export type PostDailySnapshotV3Request = {
  date: string;
  timezone: string;
  captured_at?: string;
  total_usage_check: number;
  unlock_count: number;
  time_of_day_buckets_sec: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  max_continuous_sec: number;
  app_launch_count: number;
  per_app_usage_json?: Array<Record<string, unknown>>;
  per_category_usage_json?: Array<Record<string, unknown>>;
  timeline_buckets_json?: Record<string, unknown>;
  top_apps_json?: Array<Record<string, unknown>>;
  package_name?: string;
  schema_version?: string;
  source_hash?: string;
};

export type PostDailySnapshotV3Response = {
  snapshot_id: number;
  status: string;
  upserted: boolean;
  snapshot_date: string;
};

export type PostPatternCandidatesGenerateRequest = {
  date: string;
  force_regenerate?: boolean;
};

export async function getCheckinNightStats(): Promise<GetCheckinNightStatsResponse> {
  return get<GetCheckinNightStatsResponse>(ENDPOINTS.checkinStatsNight);
}

export async function getCheckinPatterns(): Promise<GetCheckinPatternsResponse> {
  return get<GetCheckinPatternsResponse>(ENDPOINTS.checkinPatterns);
}

export async function submitCheckin(
  body: PostCheckinSubmitRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.checkinSubmit, body);
}

export async function postDailySnapshotV3(
  body: PostDailySnapshotV3Request,
): Promise<PostDailySnapshotV3Response> {
  return post<PostDailySnapshotV3Response>(ENDPOINTS.usageLogsSnapshotsV3, body);
}

export async function generateCheckinPatterns(
  body: PostPatternCandidatesGenerateRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.reportPatternCandidatesGenerate, body);
}
