// 메인 홈 — 바다 배경 + 사용 로그 1건당 물고기 스프라이트(S/M/L/XL, tint 랜덤색)
//
// 로그가 쌓이는 흐름(요약):
// 1) 안드로이드 UsageStatsModule.getTodayUsage() 등으로 앱별 사용 구간을 읽음
// 2) 대시보드 진입·홈 포커스 시 syncUsageLogsOnDashboardEnter() → POST /api/v1/logs
// 3) BE는 (user, package_name, first_time_stamp) 중복이 아니면 usage_logs 행 INSERT
// 4) 홈은 GET /api/v1/logs/{userId}로 받아, 오늘(로컬 날짜 기준 first_time_stamp) 행마다 원 1개 표시
import { AppText } from "../../../components/AppText";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { IconButton, useIconButtonSize } from "../../../components/IconButton";
import type { MainStackParamList } from "../../../navigation/types";
import {
  getUsageLogsByUserId,
  type UsageLogRow,
} from "../../../services/api/dashboard.api";
import { getUserSummary } from "../../../services/api/main.api";
import { useAuthStore } from "../../../store/auth.store";
import { syncUsageLogsOnDashboardEnter } from "../../dashboard/utils/syncUsageLogs";

type Props = NativeStackScreenProps<MainStackParamList, "Home">;

/** Aseprite S/M/L/XL 에셋 — 흑백 PNG + tintColor */
export type FishTier = "s" | "m" | "l" | "xl";

const FISH_IMAGE = {
  s: require("../../../assets/images/S_fish.png"),
  m: require("../../../assets/images/M_fish.png"),
  l: require("../../../assets/images/L_fish.png"),
  xl: require("../../../assets/images/XL_fish.png"),
} as const;

/** 레이아웃·충돌 박스 (dp, 정사각) — 스프라이트 비율은 contain */
const TIER_LAYOUT_PX: Record<FishTier, number> = {
  s: 30,
  m: 60,
  l: 100,
  /** 특대 — 에셋 비율상 박스 안에 여백이 많아 보이면 값을 더 키움 */
  xl: 400,
};

export type SeaOrb = {
  id: string;
  x: Animated.Value;
  y: Animated.Value;
  color: string;
  tier: FishTier;
  /** 애니메이션 경계용 한 변 길이 */
  layoutSize: number;
};

const MAX_ORBS = 48;

/** 임시: 중·대·특대 물고기 3마리를 항상 함께 표시 (끄려면 false) */
const TEMP_DEMO_M_L_XL_FISH = true;

/**
 * 틴트 레이어 불투명도. 낮출수록(더 투명할수록) 흑백 명암·줄무늬가 잘 보임.
 * 단색 tintColor 만 쓰면 명암이 거의 사라지므로, 아래에 원본 + 위에 반투명 틴트를 겹침.
 */
const FISH_TINT_LAYER_OPACITY = 0.32;

/** 한 구간 이동 시간(ms) — 값이 클수록 느림 (최고 속도 상한을 낮춤) */
const SWIM_DURATION_MIN = 6000;
const SWIM_DURATION_SPREAD = 6000;

/** usage_duration(초) → S / M / L / XL */
function usageSecondsToTier(seconds: number): FishTier {
  const s = Math.max(0, seconds);
  if (s < 300) return "s";
  if (s < 1800) return "m";
  if (s < 7200) return "l";
  return "xl";
}

function randomOrbColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 72%, 52%)`;
}

function firstStampToMs(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function isLocalTodayFromEpochMs(ms: number, ref: Date = new Date()): boolean {
  if (ms <= 0) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function makeOrbId(logId: number): string {
  return `log-${logId}`;
}

function createOrbFromLog(log: UsageLogRow): SeaOrb {
  const tier = usageSecondsToTier(log.usage_duration ?? 0);
  const layoutSize = TIER_LAYOUT_PX[tier];
  return {
    id: makeOrbId(log.id),
    x: new Animated.Value(24 + Math.random() * 140),
    y: new Animated.Value(64 + Math.random() * 140),
    color: randomOrbColor(),
    tier,
    layoutSize,
  };
}

/** 임시 데모용 — 티어별로 시작 위치만 살짝 어긋나게 */
function createDemoOrb(tier: FishTier, slotIndex: number): SeaOrb {
  const layoutSize = TIER_LAYOUT_PX[tier];
  return {
    id: `demo-${tier}-${slotIndex}`,
    x: new Animated.Value(20 + slotIndex * 72),
    y: new Animated.Value(72 + slotIndex * 48),
    color: randomOrbColor(),
    tier,
    layoutSize,
  };
}

function demoMlxOrbs(): SeaOrb[] {
  return [
    createDemoOrb("m", 0),
    createDemoOrb("l", 1),
    createDemoOrb("xl", 2),
  ];
}

function useOrbSwim(orb: SeaOrb, bounds: { w: number; h: number }) {
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const run = () => {
      if (!alive.current) return;
      const { w, h } = bounds;
      if (w <= 0 || h <= 0) {
        setTimeout(run, 120);
        return;
      }
      const maxX = Math.max(0, w - orb.layoutSize);
      const maxY = Math.max(0, h - orb.layoutSize);
      const toX = Math.random() * maxX;
      const toY = Math.random() * maxY;
      const dur = SWIM_DURATION_MIN + Math.random() * SWIM_DURATION_SPREAD;
      Animated.parallel([
        Animated.timing(orb.x, {
          toValue: toX,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(orb.y, {
          toValue: toY,
          duration: dur,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && alive.current) run();
      });
    };
    run();
    return () => {
      alive.current = false;
    };
  }, [bounds.h, bounds.w, orb.id, orb.layoutSize, orb.x, orb.y]);
}

function OrbView({
  orb,
  bounds,
}: {
  orb: SeaOrb;
  bounds: { w: number; h: number };
}) {
  useOrbSwim(orb, bounds);
  const side = orb.layoutSize;
  const src = FISH_IMAGE[orb.tier];
  return (
    <Animated.View
      accessibilityLabel="사용 기록"
      style={[
        styles.fishOrbWrap,
        {
          width: side,
          height: side,
          transform: [{ translateX: orb.x }, { translateY: orb.y }],
        },
      ]}
    >
      <Image source={src} style={styles.fishBaseImg} resizeMode="contain" />
      <Image
        source={src}
        resizeMode="contain"
        style={[
          styles.fishTintImg,
          { tintColor: orb.color, opacity: FISH_TINT_LAYER_OPACITY },
        ]}
      />
    </Animated.View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const iconRowH = useIconButtonSize(1);
  const userId = useAuthStore((s) => s.userId);
  const [nickname, setNickname] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [seaSize, setSeaSize] = useState({ w: 0, h: 0 });
  const [orbs, setOrbs] = useState<SeaOrb[]>([]);

  const onSeaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSeaSize({ w: width, h: height });
  }, []);

  const loadLogOrbs = useCallback(async () => {
    const demo = TEMP_DEMO_M_L_XL_FISH ? demoMlxOrbs() : [];
    if (userId == null) {
      setOrbs(demo);
      return;
    }
    try {
      await syncUsageLogsOnDashboardEnter();
      const rows = await getUsageLogsByUserId(userId);
      const today = rows.filter((r) =>
        isLocalTodayFromEpochMs(firstStampToMs(r.first_time_stamp)),
      );
      const capped = today.slice(0, MAX_ORBS);
      const fromLogs = capped.map(createOrbFromLog);
      setOrbs(TEMP_DEMO_M_L_XL_FISH ? [...demo, ...fromLogs] : fromLogs);
    } catch {
      setOrbs(demo);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadLogOrbs();
    }, [loadLogOrbs]),
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getUserSummary();
        if (!alive) return;
        setNickname(s.nickname);
        setCoins(s.coin);
        setStreakDays(s.streak_days);
      } catch {
        if (alive) {
          setNickname(null);
          setCoins(null);
          setStreakDays(null);
        }
      } finally {
        if (alive) setLoadingSummary(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bounds = useMemo(
    () => ({ w: seaSize.w, h: seaSize.h }),
    [seaSize.h, seaSize.w],
  );

  /** 상점 + 상점~설정 간격 + 설정(0.5) — 가운데 2줄 영역 높이와 동일 */
  const HUD_PAD_V = 8;
  const HUD_GAP_SETTINGS = 6;
  const HUD_GAP_PROFILE_COIN = 6;
  const HUD_RIGHT_STACK_H =
    iconRowH + HUD_GAP_SETTINGS + iconRowH * 0.5;
  const seaTopOffset = useMemo(
    () => HUD_PAD_V + HUD_RIGHT_STACK_H + HUD_PAD_V + 4,
    [iconRowH],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ImageBackground
        source={require("../../../assets/images/home-sea-pixel-bg.png")}
        style={styles.bgImage}
        resizeMode="cover"
      >
        <View style={styles.bgImageInner}>
      <View
        style={[
          styles.hud,
          { paddingTop: HUD_PAD_V, paddingBottom: HUD_PAD_V },
        ]}
      >
        <View style={styles.hudRow1}>
          <IconButton
            source={require("../../../assets/icons/achievements.png")}
            onPress={() => navigation.navigate("Achievements")}
            accessibilityLabel="업적"
            sizeScale={1}
            style={styles.hudLeadingIcon}
          />
          <View
            style={[
              styles.hudMiddleColumn,
              {
                height: iconRowH,
                gap: HUD_GAP_PROFILE_COIN,
                alignSelf: "flex-start",
              },
            ]}
          >
            <Pressable
              style={[styles.pill, styles.hudMiddlePill]}
              onPress={() => navigation.navigate("Profile")}
              accessibilityRole="button"
              accessibilityLabel="프로필"
            >
              <AppText style={styles.pillText} numberOfLines={1}>
                🐬{" "}
                {loadingSummary ? "-" : nickname ?? "-"}
                {!loadingSummary &&
                streakDays != null &&
                streakDays > 0
                  ? ` · 🔥${streakDays}`
                  : ""}
                </AppText>
            </Pressable>
            <View
              style={[styles.coinsPill, styles.hudMiddlePill]}
              accessibilityLabel="보유 코인"
            >
              <AppText style={styles.pillText} numberOfLines={1}>
                💰 {loadingSummary ? "-" : coins ?? "-"} 
              </AppText>
            </View>
          </View>
          <View
            style={[styles.hudRightCluster, { height: HUD_RIGHT_STACK_H }]}
          >
            <View style={styles.hudRightIconsRow}>
              <IconButton
                source={require("../../../assets/icons/social.png")}
                onPress={() => navigation.navigate("Social")}
                accessibilityLabel="소셜"
                sizeScale={1}
                style={styles.hudTrailingIcon}
              />
              <View style={styles.hudShopColumn}>
                <IconButton
                  source={require("../../../assets/icons/store.png")}
                  onPress={() => navigation.navigate("Store")}
                  accessibilityLabel="상점"
                  sizeScale={1}
                  style={styles.hudStoreIcon}
                />
                <View
                  style={[
                    styles.hudSettingsUnderShop,
                    { marginTop: HUD_GAP_SETTINGS },
                  ]}
                >
                  <IconButton
                    source={require("../../../assets/icons/settings.png")}
                    onPress={() => navigation.navigate("Settings")}
                    accessibilityLabel="설정"
                    sizeScale={0.5}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View
        style={[styles.sea, { marginTop: seaTopOffset }]}
        onLayout={onSeaLayout}
      >
        {orbs.map((o) => (
          <OrbView key={o.id} orb={o} bounds={bounds} />
        ))}

        <View style={styles.checkinRow}>
          <IconButton
            source={require("../../../assets/icons/checkin.png")}
            onPress={() => navigation.navigate("CheckinIntro")}
            accessibilityLabel="체크인"
            sizeScale={0.75}
            style={styles.checkinIconBtn}
          />
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <IconButton
          source={require("../../../assets/icons/dashboard.png")}
          onPress={() => navigation.navigate("Dashboard")}
          accessibilityLabel="대시보드"
          style={styles.footerIconLeft}
        />
        <IconButton
          source={require("../../../assets/icons/calendar.png")}
          onPress={() => navigation.navigate("Calendar")}
          accessibilityLabel="캘린더"
          style={styles.footerIconRight}
        />
      </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  bgImage: {
    flex: 1,
  },
  bgImageInner: {
    flex: 1,
  },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    paddingHorizontal: 12,
  },
  hudRow1: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "nowrap",
    gap: 8,
  },
  hudMiddleColumn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
  },
  hudMiddlePill: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 0,
    justifyContent: "center",
    maxWidth: "100%",
  },
  coinsPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  hudLeadingIcon: {
    flexShrink: 0,
  },
  hudTrailingIcon: {
    flexShrink: 0,
  },
  hudRightCluster: {
    flexShrink: 0,
  },
  hudRightIconsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    gap: 8,
  },
  hudShopColumn: {
    alignItems: "stretch",
  },
  hudStoreIcon: {
    alignSelf: "center",
    flexShrink: 0,
  },
  hudSettingsUnderShop: {
    alignSelf: "stretch",
    alignItems: "flex-end",
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  pillText: {
    color: "#000000",
    fontSize: 16,
  },
  sea: {
    flex: 1,
    position: "relative",
  },
  fishOrbWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  fishBaseImg: {
    width: "100%",
    height: "100%",
  },
  fishTintImg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  checkinRow: {
    position: "absolute",
    right: 24,
    top: "38%",
    alignItems: "center",
    justifyContent: "center",
  },
  checkinIconBtn: {
    flexShrink: 0,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  footerIconLeft: {
    alignSelf: "flex-end",
  },
  footerIconRight: {
    alignSelf: "flex-end",
  },
});
