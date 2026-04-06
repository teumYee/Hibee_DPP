// 앱 소개 — Dolphin Pod 작동 방식
import { AppText } from "../../../components/AppText";
import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<OnboardingStackParamList, "AppIntro">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";

type IntroItem = {
  emoji: string;
  title: string;
  body: string;
};

const ITEMS: IntroItem[] = [
  {
    emoji: "👁",
    title: "관찰하기",
    body:
      "당신의 디지털 습관을 판단하지 않고 함께 관찰합니다. 도파민의 파도가 어디서 크게 일어나는지 함께 알아가요.",
  },
  {
    emoji: "👥",
    title: "함께 헤엄치기",
    body:
      "당신은 혼자가 아닙니다. Pod 돌고래 무리와 함께 서로의 여정을 이어 가고 서로를 공유해요.",
  },
  {
    emoji: "〰️",
    title: "조절하기",
    body:
      "도파민 파도를 피하지 않고 현명하게 타는 법을 배웁니다. 당신만의 리듬을 디자인해요.",
  },
];

export function AppIntroScreen({ navigation }: Props) {
  const onContinue = useCallback(() => {
    navigation.navigate("Permission");
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.title}>Dolphin Pod는{"\n"}이렇게 작동해요</AppText>
        <AppText style={styles.lead}>함께 헤엄치는 방법</AppText>

        {ITEMS.map((item) => (
          <View key={item.title} style={styles.card}>
            <AppText style={styles.emoji}>{item.emoji}</AppText>
            <View style={styles.cardText}>
              <AppText style={styles.cardTitle}>{item.title}</AppText>
              <AppText style={styles.cardBody}>{item.body}</AppText>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="이해했어요"
        >
          <AppText style={styles.primaryBtnText}>이해했어요</AppText>
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
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    color: "#111111",
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 36,
  },
  lead: {
    fontSize: 16,
    color: MAIN,
    marginBottom: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  emoji: {
    fontSize: 28,
    marginRight: 14,
    lineHeight: 34,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    color: "#111111",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444444",
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
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
  },
});
