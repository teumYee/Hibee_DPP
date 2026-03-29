// 메인 — 사용자 요약, 온보딩 등
import type { OnboardingDraft } from "../../store/auth.store";
import { get, post } from "./client";
import { ENDPOINTS } from "./endpoints";

export type GetUserSummaryResponse = {
  nickname: string;
  coins: number;
  current_character: string;
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
    struggles: [...draft.struggles],
    focus_categories: [...draft.focus_categories],
  };
}

export async function getUserSummary(): Promise<GetUserSummaryResponse> {
  return get<GetUserSummaryResponse>(ENDPOINTS.usersMeSummary);
}

export async function postNickname(body: PostNicknameRequest): Promise<void> {
  await post<void>(ENDPOINTS.usersNickname, body);
}

export async function postOnboarding(
  body: PostOnboardingRequest,
): Promise<{ message: string }> {
  return post<{ message: string }>(ENDPOINTS.usersOnboarding, body);
}
