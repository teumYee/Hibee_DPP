// 어려움 선택
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";
import { OnboardingStepLayout } from "../components/OnboardingStepLayout";
import { postGoalsStruggles } from "../../../services/api/main.api";

type Props = NativeStackScreenProps<OnboardingStackParamList, "InitialStruggles">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";
const SKIP = "#6C7A89";

type StruggleOption = {
  id: string;
  label: string;
};

const OPTIONS: StruggleOption[] = [
  {
    id: "struggle_1",
    label: "🌊 줄이려고 해도 나도 모르게 다시 켜게 돼요",
  },
  {
    id: "struggle_2",
    label: "😤 폰 안 보려고 하면 불안하거나 허전해요",
  },
  {
    id: "struggle_3",
    label: "🔁 같은 앱을 반복해서 열어보게 돼요",
  },
  {
    id: "struggle_4",
    label: "🌙 자려고 누웠는데 결국 폰을 집어들어요",
  },
  {
    id: "struggle_5",
    label: "⚡ 알림이 오면 무조건 확인하게 돼요",
  },
  {
    id: "struggle_6",
    label: "🤷 딱히 볼 것도 없는데 습관적으로 켜요",
  },
];

export function InitialStrugglesScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      await postGoalsStruggles({ struggle_ids: Array.from(selected) });
      navigation.navigate("InitialCategories", {});
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [canNext, navigation, selected]);

  const onSkip = useCallback(() => {
    // TODO: 테스트용 - BE 완성 후 제거
    navigation.navigate("InitialCategories", {});
  }, [navigation]);

  return (
    <OnboardingStepLayout
      step={4}
      title="어떤 점이 힘든가요?"
      subtitle="여러 개 골라도 괜찮아요"
      onBack={() => navigation.goBack()}
      headerRight={
        <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      }
      footer={
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            !canNext && styles.primaryBtnDisabled,
            pressed && canNext && styles.primaryBtnPressed,
          ]}
          onPress={onNext}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="다음으로"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>다음으로</Text>
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
