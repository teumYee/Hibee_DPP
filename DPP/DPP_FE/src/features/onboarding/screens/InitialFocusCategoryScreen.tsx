// 집중 관찰 카테고리
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";
import type { RootStackParamList } from "../../../navigation/types";
import { OnboardingStepLayout } from "../components/OnboardingStepLayout";
import { useAuthStore } from "../../../store/auth.store";
import { postGoalsFocusCategory } from "../../../services/api/main.api";

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  "InitialFocusCategory"
>;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";
const SKIP = "#6C7A89";

export function InitialFocusCategoryScreen({ navigation, route }: Props) {
  const { categories } = route.params;
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);
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

  const canNext = useMemo(
    () => categories.length > 0 && selected.size >= 1 && !loading,
    [categories.length, selected, loading],
  );

  const onFinish = useCallback(async () => {
    if (!canNext) return;
    setLoading(true);
    try {
      await postGoalsFocusCategory({
        category_ids: Array.from(selected),
      });
      await setOnboardingDone(true);
      const parent = navigation.getParent<
        NativeStackNavigationProp<RootStackParamList>
      >();
      parent?.navigate("Main", { screen: "Home" });
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [canNext, navigation, selected, setOnboardingDone]);

  const onSkip = useCallback(async () => {
    // TODO: 테스트용 - BE 완성 후 제거
    await setOnboardingDone(true);
    const parent = navigation.getParent<
      NativeStackNavigationProp<RootStackParamList>
    >();
    parent?.navigate("Main", { screen: "Home" });
  }, [navigation, setOnboardingDone]);

  return (
    <OnboardingStepLayout
      step={6}
      title="주로 어떤 앱을 사용하시나요?"
      subtitle="집중 관찰할 카테고리를 선택해주세요"
      onBack={() => navigation.goBack()}
      headerRight={
        <Pressable onPress={() => void onSkip()} hitSlop={8} accessibilityRole="button">
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
          onPress={onFinish}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="Pod 입장하기"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Pod 입장하기</Text>
          )}
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {categories.length === 0 ? (
          <Text style={styles.empty}>
            선택할 카테고리가 없어요. 이전 단계에서 앱을 확인해주세요.
          </Text>
        ) : null}
        {categories.map((c) => {
          const on = selected.has(c.id);
          return (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.card,
                on ? styles.cardOn : styles.cardOff,
                pressed && styles.cardPressed,
              ]}
              onPress={() => toggle(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text style={styles.emoji}>{c.icon ?? "📁"}</Text>
              <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>
                {c.name}
              </Text>
              <Text style={[styles.cardMeta, on && styles.cardMetaOn]}>
                앱 {c.app_count}개
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
  empty: {
    fontSize: 15,
    color: "#888888",
    textAlign: "center",
    marginVertical: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardOn: {
    borderColor: MAIN,
    backgroundColor: "rgba(46, 127, 193, 0.08)",
  },
  cardOff: {
    borderColor: "#CCCCCC",
    backgroundColor: BG,
  },
  cardPressed: {
    opacity: 0.9,
  },
  emoji: {
    fontSize: 24,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111111",
  },
  cardTitleOn: {
    color: "#0D2E5C",
  },
  cardMeta: {
    fontSize: 13,
    color: "#888888",
  },
  cardMetaOn: {
    color: "#555555",
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
