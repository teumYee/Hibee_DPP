// 닉네임 설정
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";
import { postNickname } from "../../../services/api/main.api";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Nickname">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";
const MAX_LEN = 12;

const SUGGESTIONS = [
  "바닷가기",
  "갈은바다",
  "고요한물결",
  "별빛고래",
  "푸른여행자",
  "깊은파도",
] as const;

export function NicknameScreen({ navigation }: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const len = value.length;
  const trimmed = useMemo(() => value.trim(), [value]);
  const canSubmit = trimmed.length > 0 && !submitting;

  const onPickChip = useCallback((nick: string) => {
    setValue(nick.slice(0, MAX_LEN));
  }, []);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await postNickname({ nickname: trimmed });
    } catch (e: unknown) {
      console.warn(e);
      // TODO: BE /api/v1/users/nickname 구현 후 에러 처리 복구
    } finally {
      navigation.navigate("InitialGoals", {});
      setSubmitting(false);
    }
  }, [canSubmit, navigation, trimmed]);

  const onSkip = useCallback(() => {
    // TODO: 테스트용 - BE 완성 후 제거
    navigation.navigate("InitialGoals", {});
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.skipRow}>
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>바다에서 부를{"\n"}이름을 정해볼까요?</Text>
        <Text style={styles.subtitle}>
          Pod 친구들과 함께할 나의 이름이에요
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(t) => setValue(t.slice(0, MAX_LEN))}
            placeholder="이름 입력"
            placeholderTextColor="#AAAAAA"
            maxLength={MAX_LEN}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="닉네임 입력"
          />
          <Text style={styles.counter} accessibilityLabel={`${len}자 입력됨`}>
            {len}/{MAX_LEN}
          </Text>
        </View>

        <Text style={styles.chipsLabel}>추천 닉네임</Text>
        <View style={styles.chips}>
          {SUGGESTIONS.map((nick) => (
            <Pressable
              key={nick}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onPickChip(nick)}
              accessibilityRole="button"
              accessibilityLabel={`${nick} 선택`}
            >
              <Text style={styles.chipText}>{nick}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>닉네임은 나중에 언제든 바꿀 수 있어요</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!canSubmit || submitting) && styles.primaryBtnDisabled,
            pressed && canSubmit && !submitting && styles.primaryBtnPressed,
          ]}
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="다음으로"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>다음으로</Text>
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
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  skipRow: {
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 6,
  },
  skipText: {
    color: "#6C7A89",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111111",
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: "#666666",
    marginBottom: 24,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    backgroundColor: "#FAFAFA",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 17,
    color: "#111111",
  },
  counter: {
    fontSize: 14,
    color: "#888888",
    marginLeft: 8,
  },
  chipsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MAIN,
    backgroundColor: "#FFFFFF",
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: 14,
    color: MAIN,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: "#888888",
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEEEEE",
    backgroundColor: BG,
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
    opacity: 0.9,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
