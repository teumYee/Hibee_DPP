// 초기 목표 패턴 선택
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
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
  | NativeStackScreenProps<OnboardingStackParamList, "InitialGoals">
  | NativeStackScreenProps<MainStackParamList, "SettingsEditGoals">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";
const SKIP = "#6C7A89";

type GoalOption = {
  id: string;
  label: string;
};

const OPTIONS: GoalOption[] = [
  {
    id: "goal_1",
    label:
      "📱 자기 전 폰 보는 습관을 줄이고 싶어요",
  },
  {
    id: "goal_2",
    label: "⏰ 앱 하나에 너무 오래 빠져드는 게 걱정돼요",
  },
  {
    id: "goal_3",
    label: "🌅 아침에 일어나자마자 폰부터 보게 돼요",
  },
  {
    id: "goal_4",
    label: "💬 SNS 눈팅에 시간을 너무 많이 써요",
  },
  {
    id: "goal_5",
    label: "🎯 집중해야 할 때 자꾸 폰을 집어들게 돼요",
  },
  {
    id: "goal_6",
    label: "😴 폰 때문에 수면 시간이 줄어드는 것 같아요",
  },
];

export function InitialGoalsScreen({ navigation, route }: Props) {
  const isEdit = route.params?.isEditMode === true;
  const setOnboardingData = useAuthStore((s) => s.setOnboardingData);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(useAuthStore.getState().onboardingData.goals),
  );
  const [loading, setLoading] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canNext = useMemo(() => selected.size >= 1 && !loading, [selected, loading]);

  const onNext = useCallback(async () => {
    if (!canNext) return;
    setLoading(true);
    try {
      await setOnboardingData({ goals: Array.from(selected) });
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
        ).navigate("InitialActiveTime", {});
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
    ).navigate("InitialActiveTime", {});
  }, [navigation]);

  return (
    <OnboardingStepLayout
      step={1}
      hideProgress={isEdit}
      title="어떤 걸 바라고 있나요?"
      subtitle="당신이 겪는 바람을 선택해주세요"
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
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {OPTIONS.map((opt) => {
          const on = selected.has(opt.id);
          return (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [
                styles.row,
                on ? styles.rowOn : styles.rowOff,
                pressed && styles.rowPressed,
              ]}
              onPress={() => toggle(opt.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.rowText, on && styles.rowTextOn]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowOn: {
    borderColor: MAIN,
    backgroundColor: "rgba(46, 127, 193, 0.08)",
  },
  rowOff: {
    borderColor: "#CCCCCC",
    backgroundColor: BG,
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333333",
  },
  rowTextOn: {
    color: "#111111",
    fontWeight: "600",
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
