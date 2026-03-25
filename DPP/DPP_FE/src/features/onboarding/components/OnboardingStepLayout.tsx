// 초기 설정 6단계 공통 — 진행 바 + 뒤로가기
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";

type Props = {
  step: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** true면 상단 단계 숫자·진행 바 숨김 (설정에서 재편집 시) */
  hideProgress?: boolean;
  headerRight?: React.ReactNode;
};

export function OnboardingStepLayout({
  step,
  totalSteps = 6,
  title,
  subtitle,
  onBack,
  children,
  footer,
  hideProgress = false,
  headerRight,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        {hideProgress ? (
          <View style={styles.headerSpacer} />
        ) : (
          <Text
            style={styles.progressLabel}
            accessibilityLabel={`${step}단계 중 ${totalSteps}단계`}
          >
            {step} / {totalSteps}
          </Text>
        )}
        <View style={styles.headerRightWrap}>
          {headerRight ?? <View style={styles.headerSpacer} />}
        </View>
      </View>
      {hideProgress ? null : (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(step / totalSteps) * 100}%` },
            ]}
          />
        </View>
      )}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.body}>{children}</View>

      {footer != null ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 24,
    color: "#333333",
    minWidth: 36,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: MAIN,
  },
  headerSpacer: {
    width: 36,
  },
  headerRightWrap: {
    minWidth: 56,
    alignItems: "flex-end",
  },
  progressTrack: {
    height: 4,
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: "#E8EEF5",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: MAIN,
    borderRadius: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111111",
    paddingHorizontal: 24,
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: "#666666",
    paddingHorizontal: 24,
    marginBottom: 16,
    lineHeight: 22,
  },
  body: {
    flex: 1,
  },
  footer: {
    marginTop: "auto",
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEEEEE",
    backgroundColor: BG,
  },
});
