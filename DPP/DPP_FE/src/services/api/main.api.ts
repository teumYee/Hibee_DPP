// 메인 — 사용자 요약, 온보딩 목표 등
import { get, post } from "./client";
import { ENDPOINTS } from "./endpoints";

export type GetUserSummaryResponse = {
  nickname: string;
  coins: number;
  current_character: string;
};

export type PostNicknameRequest = {
  nickname: string;
};

export type PostGoalsPatternsRequest = {
  pattern_ids: string[];
};

export type PostActiveTimeRequest = {
  active_time: string;
};

export type PostNightTimeRequest = {
  start_time: string;
  end_time: string;
};

export type PostGoalsStrugglesRequest = {
  struggle_ids: string[];
};

export type PostFocusCategoryRequest = {
  category_ids: string[];
};

export async function getUserSummary(): Promise<GetUserSummaryResponse> {
  return get<GetUserSummaryResponse>(ENDPOINTS.usersMeSummary);
}

export async function postNickname(body: PostNicknameRequest): Promise<void> {
  await post<void>(ENDPOINTS.usersNickname, body);
}

export async function postGoalsPatterns(
  body: PostGoalsPatternsRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.usersGoalsPatterns, body);
}

export async function postActiveTimeSettings(
  body: PostActiveTimeRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.usersSettingsActiveTime, body);
}

export async function postNightTimeSettings(
  body: PostNightTimeRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.usersSettingsNightTime, body);
}

export async function postGoalsStruggles(
  body: PostGoalsStrugglesRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.usersGoalsStruggles, body);
}

export async function postGoalsFocusCategory(
  body: PostFocusCategoryRequest,
): Promise<void> {
  await post<void>(ENDPOINTS.usersGoalsFocusCategory, body);
}
