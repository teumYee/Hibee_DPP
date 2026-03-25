// 나의 바다 기록 — TODO: getAchievements / getUserLevel 실패 시 목 데이터 대신 에러 UI·재시도
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import {
  getAchievements,
  getUserLevel,
  type Achievement,
  type UserLevel,
} from "../../../services/api/achievements.api";

type Props = NativeStackScreenProps<MainStackParamList, "Achievements">;

const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: "a1",
    name: "첫 번째 헤엄",
    description: "처음으로 체크인을 완료했어요",
    icon: "🏊",
    is_earned: true,
    earned_at: "2026-01-15",
    category: "streak",
  },
  {
    id: "a2",
    name: "7일 연속",
    description: "7일 연속으로 체크인했어요",
    icon: "🔥",
    is_earned: true,
    earned_at: "2026-01-22",
    category: "streak",
  },
  {
    id: "a3",
    name: "친구 만들기",
    description: "첫 번째 친구를 추가했어요",
    icon: "🐋",
    is_earned: true,
    earned_at: "2026-01-18",
    category: "social",
  },
  {
    id: "a4",
    name: "행복 투 더 돌핀팟",
    description: "전 바다에 말을 달린 날",
    icon: "🌊",
    is_earned: true,
    earned_at: "2026-01-19",
    category: "special",
  },
  {
    id: "a5",
    name: "잠든 고래",
    description: "심야 사용을 0분으로 만들었어요",
    icon: "🌙",
    is_earned: false,
    category: "balance",
  },
  {
    id: "a6",
    name: "균형 잡기",
    description: "도파민 밸런스 80 이상 달성",
    icon: "⚖️",
    is_earned: false,
    category: "balance",
  },
  {
    id: "a7",
    name: "소셜 고래",
    description: "친구 5명과 함께 헤엄쳤어요",
    icon: "👥",
    is_earned: false,
    category: "social",
  },
  {
    id: "a8",
    name: "심야 탈출",
    description: "2주 연속 심야 사용 없음",
    icon: "🌟",
    is_earned: false,
    category: "special",
  },
];

const DEFAULT_LEVEL: UserLevel = {
  level: 1,
  title: "파도 타는 돌고래",
  current_exp: 0,
  next_level_exp: 100,
};

function categoryEarnedBg(category: Achievement["category"]): string {
  switch (category) {
    case "streak":
      return "#E6F1FB";
    case "social":
      return "#FFE4F0";
    case "balance":
      return "#E8F5E9";
    case "special":
      return "#FFF8E1";
    default:
      return "#E6F1FB";
  }
}

export function AchievementsScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const [achievements, setAchievements] = useState<Achievement[]>(MOCK_ACHIEVEMENTS);
  const [level, setLevel] = useState<UserLevel>(DEFAULT_LEVEL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, lv] = await Promise.all([
          getAchievements(),
          getUserLevel(),
        ]);
        if (!alive) return;
        if (Array.isArray(list) && list.length > 0) {
          setAchievements(list);
        }
        if (lv && typeof lv.level === "number") {
          setLevel(lv);
        }
      } catch {
        // TODO: API 연동 후 — 목 데이터 유지 또는 토스트
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const colWidth = useMemo(() => {
    const pad = 24 * 2;
    const gap = 8;
    return (width - pad - gap * 2) / 3;
  }, [width]);

  const earnedCount = useMemo(
    () => achievements.filter((a) => a.is_earned).length,
    [achievements],
  );

  const onOpenDetail = useCallback(
    (achievement: Achievement) => {
      navigation.navigate("AchievementDetail", { achievement });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.topTitle}>나의 바다 기록</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTint} />
          <View style={styles.heroInner}>
            <View style={styles.dolphinCircle} />
            <Text style={styles.heroTitle}>{level.title}</Text>
            <Text style={styles.heroSub}>
              이제 절반 줄 수 있는 만큼 모으고 있어요 준비 시작해요
            </Text>
            <View style={styles.lvPill}>
              <Text style={styles.lvPillText}>LV.{level.level}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>여정의 기록</Text>
          <Text style={styles.sectionCount}>
            {achievements.length}개의 기억
          </Text>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#2E7FC1" />
          </View>
        ) : (
          <View style={styles.grid}>
            {achievements.map((item) => {
              const earned = item.is_earned;
              const bg = earned
                ? categoryEarnedBg(item.category)
                : "#F0F0F0";
              return (
                <Pressable
                  key={item.id}
                  style={[styles.card, { width: colWidth, backgroundColor: bg }]}
                  onPress={() => onOpenDetail(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  {!earned ? (
                    <Text style={styles.lockMark}>🔒</Text>
                  ) : null}
                  <Text
                    style={[
                      styles.cardIcon,
                      !earned && styles.cardIconMuted,
                    ]}
                  >
                    {item.icon}
                  </Text>
                  <Text
                    style={[
                      styles.cardName,
                      !earned && styles.cardNameMuted,
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: {
    fontSize: 24,
    color: "#333333",
    minWidth: 36,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
  },
  topSpacer: {
    width: 36,
  },
  scroll: {
    paddingBottom: 32,
  },
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "#1B4F8A",
    overflow: "hidden",
    marginBottom: 24,
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.06)",
    height: "45%",
  },
  heroInner: {
    padding: 24,
    alignItems: "center",
  },
  dolphinCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#87CEEB",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 14,
  },
  lvPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  lvPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7FC1",
  },
  loader: {
    paddingVertical: 24,
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 24,
    gap: 8,
    justifyContent: "flex-start",
  },
  card: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    minHeight: 100,
    position: "relative",
  },
  lockMark: {
    position: "absolute",
    top: 6,
    right: 6,
    fontSize: 11,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardIconMuted: {
    opacity: 0.3,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
  },
  cardNameMuted: {
    opacity: 0.5,
  },
});
