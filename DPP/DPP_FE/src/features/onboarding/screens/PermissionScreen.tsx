// 사용 기록 권한 안내
import React, { useCallback } from "react";
import {
  Alert,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Permission">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";

type UsageStatsModuleType = {
  checkPermission: () => Promise<boolean>;
  showSettings: () => void;
};

function getUsageStatsModule(): UsageStatsModuleType | undefined {
  const { UsageStatsModule } = NativeModules as {
    UsageStatsModule?: UsageStatsModuleType;
  };
  return UsageStatsModule;
}

const BULLETS = [
  "앱 사용 시간 및 빈도",
  "사용 시간대 패턴",
  "카테고리별 사용 통계",
] as const;

export function PermissionScreen({ navigation }: Props) {
  const onDetailPress = useCallback(() => {
    Alert.alert(
      "기기 사용 기록",
      "설정에서 ‘사용 기록 접근’을 허용하면, 어떤 앱을 얼마나 쓰는지 패턴을 함께 볼 수 있어요. 앱 안의 글·내용은 수집하지 않습니다.",
      [{ text: "확인" }],
    );
  }, []);

  const onAllowPress = useCallback(async () => {
    const mod = getUsageStatsModule();
    if (mod) {
      const granted = await mod.checkPermission();
      if (!granted) {
        mod.showSettings();
      }
    }
    navigation.navigate("Login");
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.shieldIcon} accessibilityLabel="방패 아이콘">
          🛡️
        </Text>
        <Text style={styles.title}>함께 관찰하기 위해{"\n"}권한이 필요해요</Text>
        <Text style={styles.subtitle}>
          당신의 디지털 습관을 이해하기 위한 첫 걸음
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>기기 사용 기록 접근</Text>
          <Text style={styles.cardDesc}>
            어떤 앱을 얼마나, 얼마나 사용하는지 패턴을 함께 관찰합니다.
          </Text>
          {BULLETS.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>🔒 데이터는 암호화하여 안전하게 보호됩니다</Text>
        <Text style={styles.hint}>
          👁 실제 앱 사용 내용은 보지 않아요
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onDetailPress}
          accessibilityRole="button"
          accessibilityLabel="자세히 보기"
        >
          <Text style={styles.linkText}>자세히 보기</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={onAllowPress}
          accessibilityRole="button"
          accessibilityLabel="간편 허용하기"
        >
          <Text style={styles.primaryBtnText}>간편 허용하기</Text>
        </Pressable>
      </View>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  shieldIcon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E0E8F0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#FAFCFF",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: "#444444",
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bulletDot: {
    width: 18,
    color: MAIN,
    fontSize: 14,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#333333",
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#555555",
    marginBottom: 6,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEEEEE",
    backgroundColor: BG,
    gap: 12,
  },
  linkText: {
    fontSize: 15,
    color: MAIN,
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  primaryBtn: {
    backgroundColor: MAIN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
