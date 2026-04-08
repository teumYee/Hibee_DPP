import React from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";

const MAIN = "#2E7FC1";
const TITLE = "#1A1A2E";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
};

export function LoadingOverlay({
  visible,
  title = "불러오는 중",
  message = "잠시만 기다려주세요.",
}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="large" color={MAIN} />
          </View>
          <AppText style={styles.title}>{title}</AppText>
          <AppText style={styles.message}>{message}</AppText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(13, 46, 92, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  spinnerWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEF5FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    color: TITLE,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5F6F82",
    textAlign: "center",
  },
});
