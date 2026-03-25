import notifee, {
  AndroidImportance,
  RepeatFrequency,
  TriggerType,
} from "@notifee/react-native";

/** AsyncStorage에 저장된 심야 시작 시각과 동일한 키 */
export const NIGHT_START_TIME_KEY = "night_start_time";

const CHECKIN_TRIGGER_ID = "checkin-daily-reminder";
const CHANNEL_ID = "checkin-daily";

function parseHhMm(value: string): { hour: number; minute: number } {
  const parts = value.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return { hour: 22, minute: 0 };
  }
  return {
    hour: Math.max(0, Math.min(23, Math.floor(h))),
    minute: Math.max(0, Math.min(59, Math.floor(m))),
  };
}

/** 심야 시작(nightStartTime) 2시간 전 시각 (로컬) */
export function computeTwoHoursBeforeNight(
  nightStartTime: string,
): { hour: number; minute: number } {
  const { hour, minute } = parseHhMm(nightStartTime);
  let totalMinutes = hour * 60 + minute - 120;
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

function nextOccurrenceLocal(hour: number, minute: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * 심야 2시간 전에 매일 반복되는 로컬 알림을 예약합니다.
 */
export async function scheduleCheckinNotification(
  nightStartTime: string,
): Promise<void> {
  await cancelCheckinNotification();

  await notifee.requestPermission();

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "체크인 알림",
    importance: AndroidImportance.DEFAULT,
  });

  const { hour, minute } = computeTwoHoursBeforeNight(nightStartTime);
  const next = nextOccurrenceLocal(hour, minute);

  await notifee.createTriggerNotification(
    {
      id: CHECKIN_TRIGGER_ID,
      title: "🌊 오늘 하루 돌아볼 시간이에요",
      body: "잠깐 바다로 돌아와볼까요? 체크인이 기다리고 있어요",
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: "default" },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: next.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    },
  );
}

export async function cancelCheckinNotification(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(CHECKIN_TRIGGER_ID);
  } catch {
    // 이미 취소됨 등
  }
}
