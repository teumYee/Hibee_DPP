// 메인 홈 — 바다 배경 + 돌고래
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { getUserSummary } from "../../../services/api/main.api";

type Props = NativeStackScreenProps<MainStackParamList, "Home">;

export type Dolphin = {
  id: string;
  x: Animated.Value;
  y: Animated.Value;
  color: string;
  size: number;
  bubbleText?: string;
};

const PALETTE = [
  "#FF6B9D",
  "#FFB347",
  "#87CEEB",
  "#98FB98",
  "#DDA0DD",
  "#F0E68C",
  "#40E0D0",
] as const;

const BUBBLE_POOL = [
  "오늘도 헤엄쳤어요!",
  "파도가 잔잔해요",
  "같이 헤엄쳐요~",
  "오늘 몇 번째야?",
  "바다가 좋아!",
  "잠깐 쉬어가요",
] as const;

function pickPalette(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function pickBubble(): string {
  return BUBBLE_POOL[Math.floor(Math.random() * BUBBLE_POOL.length)];
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createDolphin(): Dolphin {
  const size = 20 + Math.floor(Math.random() * 16);
  return {
    id: makeId(),
    x: new Animated.Value(40 + Math.random() * 120),
    y: new Animated.Value(80 + Math.random() * 120),
    color: pickPalette(),
    size,
    bubbleText: pickBubble(),
  };
}

function getSeaBackgroundColor(hour: number): string {
  if (hour >= 6 && hour < 12) return "#4A90D9";
  if (hour >= 12 && hour < 18) return "#2E7FC1";
  if (hour >= 18 && hour < 22) return "#1B4F8A";
  return "#0D2E5C";
}

function useDolphinSwim(
  dolphin: Dolphin,
  bounds: { w: number; h: number }) {
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
      const maxX = Math.max(0, w - dolphin.size);
      const maxY = Math.max(0, h - dolphin.size);
      const toX = Math.random() * maxX;
      const toY = Math.random() * maxY;
      const dur = 3000 + Math.random() * 3000;
      Animated.parallel([
        Animated.timing(dolphin.x, {
          toValue: toX,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(dolphin.y, {
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
  }, [bounds.h, bounds.w, dolphin.id, dolphin.x, dolphin.y]);
}


function DolphinView({
  dolphin,
  bounds,
}: {
  dolphin: Dolphin;
  bounds: { w: number; h: number };
}) {
  useDolphinSwim(dolphin, bounds);
  const half = dolphin.size / 2;
  return (
    <Animated.View
      style={[
        styles.dolphin,
        {
          width: dolphin.size,
          height: dolphin.size,
          borderRadius: half,
          backgroundColor: dolphin.color,
          transform: [{ translateX: dolphin.x }, { translateY: dolphin.y }],
        },
      ]}
      accessibilityLabel="돌고래"
    >
      {dolphin.bubbleText ? (
        <View style={styles.miniBubble}>
          <Text style={styles.miniBubbleText} numberOfLines={2}>
            {dolphin.bubbleText}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [hour, setHour] = useState(() => new Date().getHours());
  const [nickname, setNickname] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [seaSize, setSeaSize] = useState({ w: 0, h: 0 });
  /** TODO: 실제 세션/전역 스토어에서 표시할 돌고래 수 연동 */
  /** TODO: 세션/전역 스토어와 연동해 표시할 돌고래 수 결정 */
  const sessionCount = 3;
  const [dolphins, setDolphins] = useState<Dolphin[]>(() =>
    Array.from({ length: sessionCount }, () => createDolphin()),
  );

  const onSeaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSeaSize({ w: width, h: height });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getUserSummary();
        if (!alive) return;
        setNickname(s.nickname);
        setCoins(s.coins);
      } catch {
        if (alive) {
          setNickname(null);
          setCoins(null);
        }
      } finally {
        if (alive) setLoadingSummary(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bg = useMemo(() => getSeaBackgroundColor(hour), [hour]);

  const addDolphin = useCallback(() => {
    setDolphins((prev) => [...prev, createDolphin()]);
  }, []);

  const bounds = useMemo(
    () => ({ w: seaSize.w, h: seaSize.h }),
    [seaSize.h, seaSize.w],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={["top", "bottom"]}
    >
      {/* TODO: LinearGradient로 시간대별 그라데이션 배경 교체 */}
      <View style={[styles.hud, { paddingTop: insets.top + 4 }]}>
        <View style={styles.hudRow1}>
          <Pressable
            style={styles.hudIconBtn}
            onPress={() => navigation.navigate("Achievements")}
            accessibilityRole="button"
            accessibilityLabel="업적"
          >
            <Text style={styles.hudEmoji}>🌟</Text>
          </Pressable>
          <Pressable
            style={styles.pill}
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel="프로필"
          >
            <Text style={styles.pillText}>
              🐬{" "}
              {loadingSummary ? "-" : nickname ?? "-"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.pill}
            onPress={() => navigation.navigate("Store")}
            accessibilityRole="button"
            accessibilityLabel="스토어"
          >
            <Text style={styles.pillText}>
              💰 {loadingSummary ? "-" : coins ?? "-"}B
            </Text>
          </Pressable>
          <Pressable
            style={styles.hudIconBtn}
            onPress={() => navigation.navigate("Calendar")}
            accessibilityRole="button"
            accessibilityLabel="캘린더"
          >
            <Text style={styles.hudEmoji}>📅</Text>
          </Pressable>
        </View>
        <View style={styles.hudRow2}>
          <View style={styles.hudRow2Spacer} />
          <Pressable
            style={styles.hudIconBtn}
            onPress={() => navigation.navigate("Social")}
            accessibilityRole="button"
            accessibilityLabel="소셜"
          >
            <Text style={styles.hudEmoji}>👥</Text>
          </Pressable>
          <Pressable
            style={styles.hudIconBtn}
            onPress={() => navigation.navigate("Settings")}
            accessibilityRole="button"
            accessibilityLabel="설정"
          >
            <Text style={styles.hudEmoji}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[styles.sea, { marginTop: insets.top + 88 }]}
        onLayout={onSeaLayout}
      >
        {dolphins.map((d) => (
          <DolphinView key={d.id} dolphin={d} bounds={bounds} />
        ))}

        <View style={styles.checkinRow}>
          <View style={styles.checkinBubble}>
            <Text style={styles.checkinBubbleText}>오늘 어땠나요?</Text>
          </View>
          <Pressable
            style={styles.checkinBtn}
            onPress={() => navigation.navigate("CheckinIntro")}
            accessibilityRole="button"
            accessibilityLabel="체크인"
          >
            <Text style={styles.checkinBtnIcon}>💬</Text>
          </Pressable>
        </View>

        {/* TODO: 테스트용 — 배포 전 제거 */}
        <Pressable
          style={styles.addFab}
          onPress={addDolphin}
          accessibilityRole="button"
          accessibilityLabel="돌고래 추가 (테스트)"
        >
          <Text style={styles.addFabText}>+</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={styles.bottomBtn}
          onPress={() => navigation.navigate("Dashboard")}
          accessibilityRole="button"
        >
          <Text style={styles.bottomBtnText}>📊 대시보드</Text>
        </Pressable>
        <Pressable
          style={styles.bottomBtn}
          onPress={() => navigation.navigate("Calendar")}
          accessibilityRole="button"
        >
          <Text style={styles.bottomBtnText}>📅 캘린더</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  hudRow1: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  hudRow2: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  hudRow2Spacer: {
    flex: 1,
  },
  hudIconBtn: {
    padding: 6,
  },
  hudEmoji: {
    fontSize: 22,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: 140,
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  sea: {
    flex: 1,
    position: "relative",
  },
  dolphin: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  miniBubble: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 4,
    alignSelf: "center",
    marginLeft: -20,
    maxWidth: 120,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniBubbleText: {
    fontSize: 10,
    color: "#333333",
  },
  checkinRow: {
    position: "absolute",
    right: 24,
    top: "38%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkinBubble: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 160,
  },
  checkinBubbleText: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "600",
  },
  checkinBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF8C42",
    justifyContent: "center",
    alignItems: "center",
  },
  checkinBtnIcon: {
    fontSize: 22,
  },
  addFab: {
    position: "absolute",
    right: 16,
    bottom: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  addFabText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  bottomBtn: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  bottomBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
