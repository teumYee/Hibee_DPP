import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { submitCheckin } from "../../../services/api/checkin.api";
import type { KPTChoice } from "../types";

const BG = "#0D2E5C";
const KEEP = "#2E7FC1";
const PROBLEM = "#E85D24";
const TRY = "#FFD700";
const TRY_TEXT = "#1A1A2E";

type Props = NativeStackScreenProps<MainStackParamList, "CheckinComplete">;

function kptPillStyle(kpt: KPTChoice): {
  backgroundColor: string;
  textColor: string;
} {
  switch (kpt) {
    case "keep":
      return { backgroundColor: KEEP, textColor: "#FFFFFF" };
    case "problem":
      return { backgroundColor: PROBLEM, textColor: "#FFFFFF" };
    case "try":
      return { backgroundColor: TRY, textColor: TRY_TEXT };
  }
}

export function CheckinCompleteScreen({ navigation, route }: Props) {
  const { selected } = route.params;
  const [submitting, setSubmitting] = useState(false);

  const onDone = useCallback(async () => {
    setSubmitting(true);
    try {
      const pattern_ids: [string, string, string] = [
        selected[0]?.candidate_id ?? "",
        selected[1]?.candidate_id ?? "",
        selected[2]?.candidate_id ?? "",
      ];
      await submitCheckin({
        pattern_ids,
        kpt_tags: selected.map((s) => s.kpt),
      });
      navigation.navigate("Home");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "제출에 실패했어요";
      Alert.alert("오류", msg);
    } finally {
      setSubmitting(false);
    }
  }, [navigation, selected]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>✨</Text>
        </View>
        <Text style={styles.title}>오늘의 기록을{"\n"}정리했어요</Text>
        <Text style={styles.subtitle}>
          함께 돌아본 오늘의 흐름을{"\n"}바탕으로 리포트를 준비할게요
        </Text>

        <View style={styles.summary}>
          {selected.length === 0 ? (
            <Text style={styles.passText}>오늘은 패스했어요</Text>
          ) : (
            selected.map((item) => {
              const pill = kptPillStyle(item.kpt);
              return (
                <View key={item.candidate_id} style={styles.summaryRow}>
                  <View
                    style={[
                      styles.kptPill,
                      { backgroundColor: pill.backgroundColor },
                    ]}
                  >
                    <Text style={[styles.kptPillText, { color: pill.textColor }]}>
                      {item.kpt === "keep"
                        ? "이어가기"
                        : item.kpt === "problem"
                          ? "고치기"
                          : "바꾸기"}
                    </Text>
                  </View>
                  <Text style={styles.summaryLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.doneBtn, submitting && styles.doneBtnDisabled]}
          onPress={() => void onDone()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="완료"
        >
          {submitting ? (
            <ActivityIndicator color="#2E7FC1" />
          ) : (
            <Text style={styles.doneLabel}>완료</Text>
          )}
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
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1D9E75",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 16,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },
  summary: {},
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  kptPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 10,
  },
  kptPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  summaryLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    minWidth: 120,
  },
  passText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  doneBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  doneBtnDisabled: {
    opacity: 0.85,
  },
  doneLabel: {
    color: "#2E7FC1",
    fontSize: 17,
    fontWeight: "700",
  },
});
