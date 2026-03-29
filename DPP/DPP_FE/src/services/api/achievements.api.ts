// 업적·레벨 API — TODO: 백엔드 응답 스키마에 맞게 타입·파싱 조정
import { get } from "./client";
import { ENDPOINTS } from "./endpoints";

export type AchievementCategory =
  | "streak"
  | "social"
  | "balance"
  | "special";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_earned: boolean;
  earned_at?: string;
  category: AchievementCategory;
};

export type UserLevel = {
  level: number;
  title: string;
  current_exp: number;
  next_level_exp: number;
};

/** TODO: GET `/users/me/achievements` — 배열 래핑·필드 매핑 */
export async function getAchievements(): Promise<Achievement[]> {
  return get<Achievement[]>(ENDPOINTS.userAchievements);
}

/** TODO: GET `/users/me/level` — 필드명·타입 백엔드와 동기화 */
export async function getUserLevel(): Promise<UserLevel> {
  return get<UserLevel>(ENDPOINTS.userLevel);
}
