// 업적 상세 — Main 스택에서 modal로 표시
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import type { Achievement } from "../../../services/api/achievements.api";

type Props = NativeStackScreenProps<MainStackParamList, "AchievementDetail">;

const MAIN = "#2E7FC1";

function categoryCircleBg(category: Achievement["category"]): string {
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

function formatEarnedLine(iso: string): string {
  const parts = iso.split("-");
  if (parts.length >= 3) {
    const [y, m, d] = parts;
    return `${y}.${m}.${d}`;
  }
  return iso;
}

export function AchievementDetailScreen({ navigation, route }: Props) {
  const { achievement } = route.params;

  const earnedLabel = useMemo(() => {
    if (!achievement.earned_at) return null;
    return formatEarnedLine(achievement.earned_at);
  }, [achievement.earned_at]);

  const circleBg = categoryCircleBg(achievement.category);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>기억의 조각</Text>

        <View style={[styles.iconCircle, { backgroundColor: circleBg }]}>
          <Text style={styles.iconEmoji}>{achievement.icon}</Text>
        </View>

        <Text style={styles.name}>{achievement.name}</Text>
        <Text style={styles.desc}>{achievement.description}</Text>

        {achievement.is_earned && earnedLabel ? (
          <Text style={styles.earned}>
            📅 {earnedLabel} 달성
          </Text>
        ) : (
          <Text style={styles.locked}>🔒 아직 달성하지 못했어요</Text>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  closeBtn: {
    fontSize: 22,
    color: "#333333",
    padding: 8,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
  },
  kicker: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  iconCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 64,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    marginBottom: 12,
  },
  desc: {
    fontSize: 16,
    lineHeight: 24,
    color: "#555555",
    textAlign: "center",
    marginBottom: 20,
  },
  earned: {
    fontSize: 15,
    fontWeight: "600",
    color: MAIN,
  },
  locked: {
    fontSize: 15,
    color: "#888888",
  },
});
