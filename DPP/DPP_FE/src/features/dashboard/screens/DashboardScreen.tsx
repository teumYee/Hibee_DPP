import { AppText } from "../../../components/AppText";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { DashboardAppIcon } from "../components/DashboardAppIcon";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { get } from "../../../services/api/client";
import { ENDPOINTS } from "../../../services/api/endpoints";
import { getUserSummary } from "../../../services/api/main.api";
import { useAuthStore } from "../../../store/auth.store";
import { formatMinutes } from "../utils/formatMinutes";
import { syncUsageLogsOnDashboardEnter } from "../utils/syncUsageLogs";

const BG = "#F5F7FA";
const MAIN = "#2E7FC1";
const TITLE = "#1A1A2E";
const CARD_RADIUS = 16;
const GAP = 12;
const TARGET_CONTINUOUS_MIN = 60;

type DashboardData = {
  total_usage_minutes: number;
  unlock_count: number;
  unlock_count_yesterday: number;
  most_used_app: {
    name: string;
    minutes: number;
    package_name?: string | null;
  };
  top_apps: {
    name: string;
    visit_count: number;
    package_name?: string | null;
  }[];
  max_continuous_minutes: number;
  /** BE에 구간 미제공 시 null — 임의 시각 표시 안 함 */
  max_continuous_start: string | null;
  max_continuous_end: string | null;
  /** 어제 00:00~24:00 총 사용(분). “동일 시각” 누적 비교는 로그 설계 미구현 */
  yesterday_total_minutes: number;
};

const MOCK_DASHBOARD: DashboardData = {
  total_usage_minutes: 142,
  unlock_count: 54,
  unlock_count_yesterday: 61,
  most_used_app: {
    name: "YouTube",
    minutes: 38,
    package_name: "com.google.android.youtube",
  },
  top_apps: [
    {
      name: "YouTube",
      visit_count: 38,
      package_name: "com.google.android.youtube",
    },
    {
      name: "Instagram",
      visit_count: 29,
      package_name: "com.instagram.android",
    },
    {
      name: "Chrome",
      visit_count: 17,
      package_name: "com.android.chrome",
    },
  ],
  max_continuous_minutes: 72,
  max_continuous_start: null,
  max_continuous_end: null,
  yesterday_total_minutes: 158,
};

const ENCOURAGEMENT_TEMPLATES = [
  "오늘도 바다를 헤엄치고 있네요 🐬",
  "파도가 와도 괜찮아요, 잘 하고 있어요",
  "지금 이 순간도 충분해요 ✨",
  "바다는 늘 당신 편이에요",
  "조금씩 나아가는 것만으로도 대단해요",
  "오늘의 파도는 당신이 이겨낼 수 있어요",
  "함께 헤엄치고 있어요, 혼자가 아니에요 🌊",
  "잠깐 숨 고르는 것도 헤엄의 일부예요",
  "깊은 바다도 두렵지 않아요, 돌핀팟이 있으니까요",
  "천천히 헤엄쳐도 괜찮아요",
  "파도에 흔들려도 방향은 잃지 않았어요",
  "{nickname}님, 오늘도 여기 있어줘서 고마워요 🐬",
  "{nickname}님, 잘 헤엄치고 있어요 🌊",
  "{nickname}님, 돌핀팟이 항상 응원하고 있어요",
  "오늘도 수고했어요, {nickname} 🐬",
] as const;

function formatTodayHeader(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

/** 로컬 시각 기준 HH:MM ~ HH:MM, 파싱 실패 시 null */
function formatClockRangeHHMM(startIso: string, endIso: string): string | null {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(s.getHours())}:${pad(s.getMinutes())} ~ ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

function isNightNow(d: Date): boolean {
  const h = d.getHours();
  return h >= 22 || h < 6;
}

/** 오늘 휴대폰 확인(언락) 횟수 기준 — 바다 문구 */
function seaStateText(unlockCount: number): string {
  if (unlockCount <= 20) return "잔잔해요 — 바다가 평화롭네요";
  if (unlockCount <= 45) return "파도가 조금 있어요 — 적당히 출렁이고 있어요";
  if (unlockCount <= 80) return "파도가 거세요 — 오늘 꽤 바빴네요";
  return "폭풍우가 몰아치고 있어요 — 잠깐 쉬어가요";
}

function applyNickname(template: string, nickname: string): string {
  return template.replace(/\{nickname\}/g, nickname);
}

type Props = NativeStackScreenProps<MainStackParamList, "Dashboard">;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * GET /dashboard/summary/{user_id} 응답 매핑
 * - summary.total_time, longest_session: 분
 * - summary.longest_session_start / longest_session_end: ISO8601 (해당 로그의 first/last 타임스탬프)
 * - summary.yesterday_total_time, yesterday_total_unlocks: 어제 하루 합산
 * - top_visited: { name, count, package_name? }[]
 */
function toDashboardData(raw: unknown): DashboardData | null {
  if (!isRecord(raw)) return null;
  const summary = raw.summary;
  const mostUsedApp = raw.most_used_app;
  const topVisitedRaw = raw.top_visited;
  if (!isRecord(summary) || !isRecord(mostUsedApp) || !Array.isArray(topVisitedRaw)) {
    return null;
  }

  const totalTime = summary.total_time;
  const totalUnlocks = summary.total_unlocks;
  const longestSession = summary.longest_session;
  const yesterdayTotalTime = summary.yesterday_total_time;
  const yesterdayTotalUnlocks = summary.yesterday_total_unlocks;
  const longestStart = summary.longest_session_start;
  const longestEnd = summary.longest_session_end;
  const muName = mostUsedApp.name;
  const muMinutes = mostUsedApp.minutes;
  const muPkg = mostUsedApp.package_name;
  if (
    typeof totalTime !== "number" ||
    typeof totalUnlocks !== "number" ||
    typeof longestSession !== "number" ||
    typeof muName !== "string" ||
    typeof muMinutes !== "number"
  ) {
    return null;
  }

  const top_apps = topVisitedRaw
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = item.name;
      const count = item.count;
      const package_name = item.package_name;
      if (typeof name !== "string" || typeof count !== "number") return null;
      return {
        name,
        visit_count: count,
        package_name: typeof package_name === "string" ? package_name : null,
      };
    })
    .filter(
      (item): item is {
        name: string;
        visit_count: number;
        package_name: string | null;
      } => item != null,
    )
    .slice(0, 3);

  const totalUsageMinutes = Math.max(0, Math.round(totalTime));
  const longestMinutes = Math.max(0, Math.round(longestSession));
  const mostMinutes = Math.max(0, Math.round(muMinutes));
  const yMinutes =
    typeof yesterdayTotalTime === "number"
      ? Math.max(0, Math.round(yesterdayTotalTime))
      : 0;
  const yUnlocks =
    typeof yesterdayTotalUnlocks === "number"
      ? Math.max(0, Math.round(yesterdayTotalUnlocks))
      : 0;

  let maxStart: string | null = null;
  let maxEnd: string | null = null;
  if (
    typeof longestStart === "string" &&
    typeof longestEnd === "string" &&
    longestStart.length > 0 &&
    longestEnd.length > 0
  ) {
    maxStart = longestStart;
    maxEnd = longestEnd;
  }

  return {
    total_usage_minutes: totalUsageMinutes,
    unlock_count: totalUnlocks,
    unlock_count_yesterday: yUnlocks,
    most_used_app: {
      name: muName,
      minutes: mostMinutes,
      package_name: typeof muPkg === "string" ? muPkg : null,
    },
    top_apps,
    max_continuous_minutes: longestMinutes,
    max_continuous_start: maxStart,
    max_continuous_end: maxEnd,
    yesterday_total_minutes: yMinutes,
  };
}

export function DashboardScreen({ navigation }: Props) {
  const userId = useAuthStore((s) => s.userId);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");

  const [mentIndex] = useState(() =>
    Math.floor(Math.random() * ENCOURAGEMENT_TEMPLATES.length),
  );

  const encouragement = useMemo(() => {
    const raw = ENCOURAGEMENT_TEMPLATES[mentIndex] ?? ENCOURAGEMENT_TEMPLATES[0];
    const name = nickname.trim() || "돌핀";
    return applyNickname(raw, name);
  }, [mentIndex, nickname]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await syncUsageLogsOnDashboardEnter();
      if (userId == null) {
        setData(MOCK_DASHBOARD);
        return;
      }
      const summaryUrl = `${ENDPOINTS.dashboardSummary}/${userId}`;
      const res = await get<unknown>(summaryUrl);
      const parsed = toDashboardData(res);
      setData(parsed ?? MOCK_DASHBOARD);
    } catch {
      setData(MOCK_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getUserSummary();
        if (!cancelled) setNickname(s.nickname);
      } catch {
        if (!cancelled) setNickname("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const night = isNightNow(new Date());

  const unlockSubtitle = useMemo(() => {
    if (!data) return null;
    const d = data.unlock_count - data.unlock_count_yesterday;
    if (d > 0) {
      return { text: `어제보다 ${d}번 더 확인했어요`, color: "#E53935" };
    }
    if (d < 0) {
      return {
        text: `어제보다 ${Math.abs(d)}번 덜 확인했어요`,
        color: MAIN,
      };
    }
    return { text: "어제와 비슷해요", color: "#666666" };
  }, [data]);

  const continuousProgress = useMemo(() => {
    if (!data) return { widthPct: 0, over: false };
    const m = data.max_continuous_minutes;
    const over = m > TARGET_CONTINUOUS_MIN;
    const widthPct = Math.min(100, (m / TARGET_CONTINUOUS_MIN) * 100);
    return { widthPct, over };
  }, [data]);

  const yesterdayDiff = useMemo(() => {
    if (!data) return null;
    return data.total_usage_minutes - data.yesterday_total_minutes;
  }, [data]);

  const topThree = useMemo(() => {
    if (!data?.top_apps?.length) return [];
    return data.top_apps.slice(0, 3);
  }, [data]);

  const headerDate = useMemo(() => formatTodayHeader(new Date()), []);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={MAIN} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return null;
  }

  const continuousClockLabel =
    data.max_continuous_start && data.max_continuous_end
      ? formatClockRangeHHMM(
          data.max_continuous_start,
          data.max_continuous_end,
        )
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {night ? (
        <View style={styles.nightBanner}>
          <AppText style={styles.nightBannerText}>
            🌙 지금은 심야 시간이에요. 바다가 쉬고 싶어해요
          </AppText>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <AppText style={styles.backArrow}>←</AppText>
          </Pressable>
          <View style={styles.headerCenter}>
            <AppText style={styles.headerDate}>{headerDate}</AppText>
            <AppText style={styles.headerSub}>오늘의 기록</AppText>
          </View>
          <View style={styles.headerTrailingSpacer} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconOrange]}>
              <AppText style={styles.iconEmoji}>🕐</AppText>
            </View>
            <AppText style={styles.cardTitle}>오늘 휴대폰을 사용한 시간</AppText>
          </View>
          <AppText style={styles.mainNumber}>
            {formatMinutes(data.total_usage_minutes)}
          </AppText>
          <AppText style={styles.cardCaption}>{encouragement}</AppText>
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconBlue]}>
              <AppText style={styles.iconEmoji}>📱</AppText>
            </View>
            <AppText style={styles.cardTitle}>휴대폰을 확인한 횟수</AppText>
          </View>
          <AppText style={styles.mainNumber}>{data.unlock_count}번</AppText>
          {unlockSubtitle ? (
            <AppText style={[styles.cardCaption, { color: unlockSubtitle.color }]}>
              {unlockSubtitle.text}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconBlueLight]}>
              <AppText style={styles.iconEmoji}>📱</AppText>
            </View>
            <AppText style={styles.cardTitle}>가장 오래 함께한 앱</AppText>
          </View>
          <View style={styles.mostUsedRow}>
            <DashboardAppIcon
              packageName={data.most_used_app.package_name}
              size={48}
            />
            <View style={styles.mostUsedTextCol}>
              <AppText style={[styles.appNameBold, styles.appNameInRow]}>
                {data.most_used_app.name}
              </AppText>
              <AppText style={[styles.cardCaption, styles.cardCaptionTightTop]}>
                {formatMinutes(data.most_used_app.minutes)}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <AppText style={styles.sectionTitle}>자주 들른 곳</AppText>
          {topThree.map((app, idx) => (
            <View key={`${app.name}-${idx}`}>
              {idx > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.rowApp}>
                <DashboardAppIcon packageName={app.package_name} size={36} />
                <View style={styles.rowAppText}>
                  <AppText style={styles.appNameList}>{app.name}</AppText>
                  <AppText style={styles.visitMinutes}>
                    {app.visit_count}번 방문
                  </AppText>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconYellow]}>
              <AppText style={styles.iconEmoji}>⚡</AppText>
            </View>
            <AppText style={styles.cardTitle}>가장 긴 연속 사용 시간</AppText>
          </View>
          <AppText style={styles.mainNumber}>
            {formatMinutes(data.max_continuous_minutes)}
          </AppText>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${continuousProgress.widthPct}%`,
                  backgroundColor: continuousProgress.over
                    ? "#E53935"
                    : MAIN,
                },
              ]}
            />
          </View>
          {continuousClockLabel ? (
            <AppText style={styles.cardCaption}>{continuousClockLabel}</AppText>
          ) : (
            <AppText style={styles.cardCaptionMuted}>
              오늘 동기화된 로그들 중, 앱별로 잡힌 연속 포그라운드 시간의 최댓값이에요
            </AppText>
          )}
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconWave]}>
              <AppText style={styles.iconEmoji}>🌊</AppText>
            </View>
            <AppText style={styles.cardTitle}>지금 바다 상태</AppText>
          </View>
          <AppText style={styles.seaStateText}>
            {seaStateText(data.unlock_count)}
          </AppText>
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconTrend]}>
              <AppText style={styles.iconEmoji}>
                {yesterdayDiff !== null && yesterdayDiff < 0 ? "📉" : "📈"}
              </AppText>
            </View>
            <AppText style={styles.cardTitle}>어제 하루 총 사용 대비</AppText>
          </View>
          <AppText style={styles.yesterdayLine}>
            어제 하루 총 사용은{" "}
            {formatMinutes(data.yesterday_total_minutes)}이에요
          </AppText>
          {yesterdayDiff !== null ? (
            <>
              <AppText
                style={[
                  styles.diffMinutes,
                  yesterdayDiff > 0
                    ? styles.diffUp
                    : yesterdayDiff < 0
                      ? styles.diffDown
                      : styles.diffNeutral,
                ]}
              >
                {yesterdayDiff === 0
                  ? "0분"
                  : yesterdayDiff > 0
                    ? `+${yesterdayDiff}분`
                    : `-${Math.abs(yesterdayDiff)}분`}
              </AppText>
              <AppText style={styles.cardCaptionMuted}>
                오늘 현재까지 누적 사용과, 어제 하루 총 사용의 차이예요
              </AppText>
            </>
          ) : null}
        </View>
      </ScrollView>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={MAIN} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 247, 250, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  nightBanner: {
    backgroundColor: "#0D2E5C",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  nightBannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 4,
  },
  backBtn: {
    width: 44,
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 24,
    color: TITLE,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTrailingSpacer: {
    width: 44,
  },
  headerDate: {
    fontSize: 17,

    color: TITLE,
  },
  headerSub: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  cardGap: {
    marginTop: GAP,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  iconOrange: { backgroundColor: "#FFF3E0" },
  iconBlue: { backgroundColor: "#E3F2FD" },
  iconBlueLight: { backgroundColor: "#E8F4FC" },
  iconYellow: { backgroundColor: "#FFFDE7" },
  iconWave: { backgroundColor: "#E8F4FC" },
  iconTrend: { backgroundColor: "#F3E5F5" },
  iconEmoji: {
    fontSize: 20,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,

    color: TITLE,
  },
  mainNumber: {
    fontSize: 32,

    color: TITLE,
    marginTop: 4,
  },
  cardCaption: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    lineHeight: 20,
  },
  cardCaptionMuted: {
    fontSize: 12,
    color: "#888888",
    marginTop: 8,
    lineHeight: 18,
  },
  appNameBold: {
    fontSize: 18,

    color: TITLE,
    marginTop: 4,
  },
  mostUsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  mostUsedTextCol: {
    flex: 1,
    minWidth: 0,
  },
  appNameInRow: {
    marginTop: 0,
  },
  cardCaptionTightTop: {
    marginTop: 4,
  },
  sectionBlock: {
    marginTop: GAP,
  },
  sectionTitle: {
    fontSize: 16,

    color: TITLE,
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E0E0E0",
    marginVertical: 12,
  },
  rowApp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowAppText: {
    flex: 1,
  },
  appNameList: {
    fontSize: 16,

    color: TITLE,
  },
  visitMinutes: {
    fontSize: 14,
    color: "#666666",
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8ECEF",
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  seaStateText: {
    fontSize: 15,
    color: "#444444",
    lineHeight: 22,
    marginTop: 4,
  },
  yesterdayLine: {
    fontSize: 15,
    color: "#444444",
    marginTop: 4,
    lineHeight: 22,
  },
  diffMinutes: {
    fontSize: 18,

    marginTop: 8,
  },
  diffUp: {
    color: "#E53935",
  },
  diffDown: {
    color: MAIN,
  },
  diffNeutral: {
    color: "#666666",
  },
});
