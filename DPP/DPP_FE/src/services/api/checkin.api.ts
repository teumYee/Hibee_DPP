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
