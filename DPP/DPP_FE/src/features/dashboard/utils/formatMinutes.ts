/** 60분 미만은 "NN분", 이상은 "N시간 NN분" */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return "0분";
  }
  const m = Math.floor(minutes);
  if (m < 60) {
    return `${m}분`;
  }
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}
