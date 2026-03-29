// 설정·계정 삭제 등 — TODO: 백엔드 계약에 맞게 요청/응답 처리
import { del } from "./client";
import { ENDPOINTS } from "./endpoints";

/** TODO: DELETE `/users/me/data` — 성공 후 로컬 상태·캐시 정리 */
export async function deleteUserData(): Promise<void> {
  await del<void>(ENDPOINTS.deleteUserData);
}

/** TODO: DELETE `/users/me` — 회원 탈퇴 플로우에서 사용 */
export async function deleteUserAccount(): Promise<void> {
  await del<void>(ENDPOINTS.deleteUser);
}
