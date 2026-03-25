// 사용자 로그 API
import { get } from "./client";
import { ENDPOINTS } from "./endpoints";

// TODO: BE 응답 확인 후 타입 정의
export async function getUserLogs(userId: number): Promise<unknown> {
  return get<unknown>(`${ENDPOINTS.usageLogsByUser}/${encodeURIComponent(String(userId))}`);
}
