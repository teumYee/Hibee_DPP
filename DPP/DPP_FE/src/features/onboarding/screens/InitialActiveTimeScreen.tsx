// 주로 활동하는 시간대
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type {
  MainStackParamList,
  OnboardingStackParamList,
} from "../../../navigation/types";
import {
  buildOnboardingPayload,
  postOnboarding,
} from "../../../services/api/main.api";
import { useAuthStore } from "../../../store/auth.store";
import { OnboardingStepLayout } from "../components/OnboardingStepLayout";

type Props =
  | NativeStackScreenProps<OnboardingStackParamList, "InitialActiveTime">
  | NativeStackScreenProps<MainStackParamList, "SettingsEditActiveTime">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";
const SKIP = "#6C7A89";

type Slot = {
  id: string;
  label: string;
  range: string;
  emoji: string;
};

const SLOTS: Slot[] = [
  { id: "dawn", label: "새벽", range: "00:00 - 06:00", emoji: "🌙" },
  { id: "morning", label: "아침", range: "06:00 - 09:00", emoji: "🌅" },
  { id: "late_morning", label: "오전", range: "09:00 - 12:00", emoji: "☀️" },
  { id: "afternoon", label: "오후", range: "12:00 - 18:00", emoji: "🌤" },
  { id: "evening", label: "저녁", range: "18:00 - 22:00", emoji: "🌆" },
  { id: "night", label: "밤", range: "22:00 - 24:00", emoji: "🌃" },
];

export function InitialActiveTimeScreen({ navigation, route }: Props) {
  const isEdit = route.params?.isEditMode === true;
  const setOnboardingData = useAuthStore((s) => s.setOnboardingData);
  const [selected, setSelected] = useState<string | null>(() => {
    const t = useAuthStore.getState().onboardingData.active_time;
    return t.length > 0 ? t : null;
  });
  const [loading, setLoading] = useState(false);

  const canNext = useMemo(() => selected != null && !loading, [selected, loading]);

  const onNext = useCallback(async () => {
    if (selected == null || !canNext) return;
    setLoading(true);
    try {
      await setOnboardingData({ active_time: selected });
      if (isEdit) {
        const uid = useAuthStore.getState().userId;
        if (uid == null) {
          Alert.alert("오류", "로그인 정보가 없어요.");
          return;
        }
        await postOnboarding(
          buildOnboardingPayload(uid, useAuthStore.getState().onboardingData),
        );
        navigation.goBack();
      } else {
        (
          navigation as NativeStackNavigationProp<OnboardingStackParamList>
        ).navigate("InitialNightTime", {});
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "저장에 실패했어요";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  }, [canNext, isEdit, navigation, selected, setOnboardingData]);

  const onSkip = useCallback(() => {
    (
      navigation as NativeStackNavigationProp<OnboardingStackParamList>
    ).navigate("InitialNightTime", {});
  }, [navigation]);

  return (
    <OnboardingStepLayout
      step={2}
      hideProgress={isEdit}
      title="하루 중, 가장 많이 헤엄치는 시간은 언제인가요?"
      subtitle="주로 활동하는 시간대를 골라주세요"
      onBack={() => navigation.goBack()}
      headerRight={
        !isEdit ? (
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        ) : undefined
      }
      footer={
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            !canNext && styles.primaryBtnDisabled,
            pressed && canNext && styles.primaryBtnPressed,
          ]}
          onPress={() => void onNext()}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? "저장하기" : "다음으로"}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {isEdit ? "저장하기" : "다음으로"}
            </Text>
          )}
        </Pressable>
      }
    >
      <View style={styles.grid}>
        {SLOTS.map((slot) => {
          const on = selected === slot.id;
          return (
            <Pressable
              key={slot.id}
              style={({ pressed }) => [
                styles.card,
                on ? styles.cardOn : styles.cardOff,
                pressed && styles.cardPressed,
              ]}
              onPress={() => setSelected(slot.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={styles.emoji}>{slot.emoji}</Text>
              <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>
                {slot.label}
              </Text>
              <Text style={[styles.cardRange, on && styles.cardRangeOn]}>
                {slot.range}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
    justifyContent: "space-between",
  },
  card: {
    width: "47%",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  cardOn: {
    backgroundColor: MAIN,
    borderColor: MAIN,
  },
  cardOff: {
    backgroundColor: BG,
    borderColor: "#DDDDDD",
  },
  cardPressed: {
    opacity: 0.9,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 4,
  },
  cardTitleOn: {
    color: "#FFFFFF",
  },
  cardRange: {
    fontSize: 12,
    color: "#888888",
    textAlign: "center",
  },
  cardRangeOn: {
    color: "rgba(255,255,255,0.9)",
  },
  primaryBtn: {
    backgroundColor: MAIN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnPressed: {
    opacity: 0.92,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  skipText: {
    color: SKIP,
    fontSize: 14,
    fontWeight: "600",
  },
});
