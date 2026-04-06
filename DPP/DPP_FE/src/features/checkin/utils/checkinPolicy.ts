import { useAuthStore } from "../../../store/auth.store";

export const DEFAULT_CHECKIN_TIME = "21:00";
export const DEFAULT_CHECKIN_WINDOW_MINUTES = 120;
export const DEFAULT_DAY_ROLLOVER_TIME = "04:00";

export type CheckinPolicy = {
  checkinTime: string;
  checkinWindowMinutes: number;
  dayRolloverTime: string;
};

function parseHhMm(value: string, fallback: string): { hour: number; minute: number } {
  const raw = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw) ?? /^(\d{1,2})$/.exec(raw);
  if (!match) {
    return parseHhMm(fallback, fallback);
  }
  const hour = Number(match[1]);
  const minute = match.length > 2 ? Number(match[2]) : 0;
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return parseHhMm(fallback, fallback);
  }
  return { hour, minute };
}

export function formatHhMm(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function deriveCheckinTimeFromNightStart(nightModeStart: string): string {
  const { hour, minute } = parseHhMm(nightModeStart, DEFAULT_CHECKIN_TIME);
  let totalMinutes = hour * 60 + minute - 120;
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  return formatHhMm(Math.floor(totalMinutes / 60), totalMinutes % 60);
}

export function getStoredCheckinPolicy(): CheckinPolicy {
  const draft = useAuthStore.getState().onboardingData;
  return {
    checkinTime:
      draft.checkin_time?.trim() ||
      deriveCheckinTimeFromNightStart(draft.night_mode_start || DEFAULT_CHECKIN_TIME),
    checkinWindowMinutes:
      typeof draft.checkin_window_minutes === "number" && draft.checkin_window_minutes > 0
        ? draft.checkin_window_minutes
        : DEFAULT_CHECKIN_WINDOW_MINUTES,
    dayRolloverTime: draft.day_rollover_time?.trim() || DEFAULT_DAY_ROLLOVER_TIME,
  };
}

export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function getLogicalDate(now: Date = new Date(), policy = getStoredCheckinPolicy()): string {
  const rollover = parseHhMm(policy.dayRolloverTime, DEFAULT_DAY_ROLLOVER_TIME);
  const logical = new Date(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const rolloverMinutes = rollover.hour * 60 + rollover.minute;
  if (currentMinutes < rolloverMinutes) {
    logical.setDate(logical.getDate() - 1);
  }
  return formatLocalDate(logical);
}

function withTime(base: Date, hhmm: string): Date {
  const { hour, minute } = parseHhMm(hhmm, DEFAULT_CHECKIN_TIME);
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function getCheckinWindowState(now: Date = new Date(), policy = getStoredCheckinPolicy()) {
  const logicalDate = getLogicalDate(now, policy);
  const [year, month, day] = logicalDate.split("-").map(Number);
  const logicalBase = new Date(year, month - 1, day);
  const center = withTime(logicalBase, policy.checkinTime);
  const radiusMs = policy.checkinWindowMinutes * 60 * 1000;
  const windowStart = new Date(center.getTime() - radiusMs);
  const windowEnd = new Date(center.getTime() + radiusMs);
  return {
    logicalDate,
    windowStart,
    windowEnd,
    isOpen: now >= windowStart && now <= windowEnd,
  };
}

export function buildCheckinWindowMessage(now: Date = new Date()): string {
  const { windowStart, windowEnd } = getCheckinWindowState(now);
  return `체크인은 ${formatHhMm(
    windowStart.getHours(),
    windowStart.getMinutes(),
  )}부터 ${formatHhMm(windowEnd.getHours(), windowEnd.getMinutes())} 사이에 열려요.`;
}
