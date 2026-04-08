// 메인 — 사용자 요약, 온보딩 등
import type { OnboardingDraft } from "../../store/auth.store";
import { useAuthStore } from "../../store/auth.store";
import { get, post } from "./client";
import { ENDPOINTS } from "./endpoints";

export type GetUserSummaryResponse = {
  nickname: string;
  coin: number;
  streak_days: number;
};

export type UserBootstrapResponse = {
  user_id: number;
  nickname: string | null;
  onboarding_completed: boolean;
  onboarding_data: {
    goals: string[];
    active_times: string[];
    night_mode_start: string;
    night_mode_end: string;
    checkin_time: string;
    checkin_window_minutes: number;
    day_rollover_time: string;
    struggles: string[];
    focus_categories: string[];
  };
};

export type PostNicknameRequest = {
  user_id: number;
  nickname: string;
};

export type PostOnboardingRequest = {
  user_id: number;
  goals: string[];
  active_times: string[];
  night_mode_start: string;
  night_mode_end: string;
  checkin_time: string;
  checkin_window_minutes: number;
  day_rollover_time: string;
  struggles: string[];
  focus_categories: string[];
};

export function buildOnboardingPayload(
  userId: number,
  draft: OnboardingDraft,
): PostOnboardingRequest {
  return {
    user_id: userId,
    goals: [...draft.goals],
    active_times: draft.active_time ? [draft.active_time] : [],
    night_mode_start: draft.night_mode_start,
    night_mode_end: draft.night_mode_end,
    checkin_time: draft.checkin_time,
    checkin_window_minutes: draft.checkin_window_minutes,
    day_rollover_time: draft.day_rollover_time,
    struggles: [...draft.struggles],
    focus_categories: [...draft.focus_categories],
  };
}

export async function getUserSummary(): Promise<GetUserSummaryResponse> {
  const userId = useAuthStore.getState().userId;
  if (userId == null) {
    throw new Error("getUserSummary: userId is not set");
  }
  return get<GetUserSummaryResponse>(ENDPOINTS.usersMeSummary, {
    user_id: userId,
  });
}

export async function getUserBootstrap(): Promise<UserBootstrapResponse> {
  return get<UserBootstrapResponse>(ENDPOINTS.usersMeBootstrap);
}

export async function postNickname(body: PostNicknameRequest): Promise<void> {
  await post<void>(ENDPOINTS.usersNickname, body);
}

export async function postOnboarding(
  body: PostOnboardingRequest,
): Promise<{ message: string }> {
  return post<{ message: string }>(ENDPOINTS.usersOnboarding, body);
}
