// Initial setup screen component for onboarding
import { AppText } from "../../../components/AppText";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuthStore } from "../../../store/auth.store";

export function InitialSetupScreen() {
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);

  return (
    <View style={styles.wrap}>
      <AppText style={styles.title}>Initial Setup</AppText>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => void setOnboardingDone(true)}
        accessibilityRole="button"
        accessibilityLabel="온보딩 완료"
      >
        <AppText style={styles.btnLabel}>Finish Onboarding</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  title: { fontSize: 18 },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#2E7FC1",
    borderRadius: 8,
  },
  btnPressed: { opacity: 0.85 },
  btnLabel: { color: "#FFFFFF", fontSize: 16 },
});
