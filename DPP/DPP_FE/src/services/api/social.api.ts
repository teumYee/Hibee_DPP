// 소셜 — 친구, 검색, 응원, 프로필
import { del, get, post } from "./client";
import {
  ENDPOINTS,
  socialFriendCheerPath,
  socialFriendDeletePath,
  userProfilePath,
} from "./endpoints";

export type Badge = {
  id: string;
  name: string;
  icon: string;
  is_earned: boolean;
};

export type Friend = {
  id: string;
  nickname: string;
  avatar_color: string;
  streak_days: number;
  cheer_count: number;
  friend_count: number;
  is_checked_in_today: boolean;
  has_cheered_today: boolean;
  badges: Badge[];
  today_comment?: string;
};

export type SearchResult = {
  id: string;
  nickname: string;
  avatar_color: string;
  streak_days: number;
};

export async function getFriends(): Promise<Friend[]> {
  return get<Friend[]>(ENDPOINTS.socialFriends);
}

export async function searchUser(nickname: string): Promise<SearchResult[]> {
  return get<SearchResult[]>(ENDPOINTS.socialSearch, { nickname });
}

/**
 * TODO: 서버 스펙에 맞게 body 키 조정 (예: friend_id, user_id)
 */
export async function addFriend(id: string): Promise<void> {
  await post<void>(ENDPOINTS.socialFriends, { friend_id: id });
}

export async function deleteFriend(id: string): Promise<void> {
  await del<void>(socialFriendDeletePath(id));
}

export async function cheerFriend(id: string): Promise<void> {
  await post<void>(socialFriendCheerPath(id), {});
}

export async function getUserProfile(id: string): Promise<Friend> {
  return get<Friend>(userProfilePath(id));
}
