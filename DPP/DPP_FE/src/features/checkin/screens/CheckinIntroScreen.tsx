import { AppText } from "../../../components/AppText";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { getCheckinPatterns } from "../../../services/api/checkin.api";

const BG = "#0D2E5C";
const MOON = "#FFD700";

type Props = NativeStackScreenProps<MainStackParamList, "CheckinIntro">;

export function CheckinIntroScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const onStart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCheckinPatterns();
      navigation.navigate("CheckinPattern", {
        patterns: res.patterns,
        currentIndex: 0,
        selected: [],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "패턴을 불러오지 못했어요";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Pressable
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="닫기"
      >
        <AppText style={styles.closeText}>✕</AppText>
      </Pressable>

      <View style={styles.center}>
        <View style={styles.moonWrap}>
          <View style={styles.droplet} />
          <View style={styles.moon} />
        </View>
        <AppText style={styles.title}>오늘 하루,{"\n"}잠깐 돌아볼까요?</AppText>
        <AppText style={styles.subtitle}>
          오늘의 흐름을 함께 정리하는{"\n"}짧은 대화 시간이에요
        </AppText>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={() => void onStart()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="시작하기"
        >
          {loading ? (
            <ActivityIndicator color="#2E7FC1" />
          ) : (
            <AppText style={styles.primaryLabel}>시작하기</AppText>
          )}
        </Pressable>
        <Pressable
          style={styles.skipBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <AppText style={styles.skipLabel}>지금은 한 번 넘어갈게요</AppText>
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
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 2,
    padding: 8,
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 22,
    opacity: 0.9,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  moonWrap: {
    width: 100,
    height: 100,
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  moon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: MOON,
  },
  droplet: {
    position: "absolute",
    top: 0,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    textAlign: "center",
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 16,
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    opacity: 0.7,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
  },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryLabel: {
    color: "#2E7FC1",
    fontSize: 17,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    opacity: 0.85,
  },
});
