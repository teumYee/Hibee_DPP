import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { MainStackParamList } from "../../../navigation/types";
import type { KPTChoice, SelectedPattern } from "../types";

const BG = "#0D2E5C";
const KEEP = "#2E7FC1";
const PROBLEM = "#E85D24";
const TRY = "#FFD700";
const TRY_TEXT = "#1A1A2E";

export function CheckinPatternScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "CheckinPattern">>();
  const { patterns, currentIndex } = route.params;
  const selected = route.params.selected;

  const [limitModalVisible, setLimitModalVisible] = useState(false);

  const onUpdateSelected = useCallback(
    (next: SelectedPattern[]) => {
      navigation.setParams({ selected: next });
    },
    [navigation],
  );

  const currentPattern = patterns[currentIndex];
  const progress =
    patterns.length === 0 ? 0 : (currentIndex + 1) / patterns.length;

  const currentKpt = currentPattern
    ? selected.find((s) => s.candidate_id === currentPattern.candidate_id)?.kpt
    : undefined;

  const onSelectKpt = useCallback(
    (kpt: KPTChoice) => {
      if (!currentPattern) return;
      const id = currentPattern.candidate_id;
      const idx = selected.findIndex((s) => s.candidate_id === id);
      if (idx >= 0) {
        const next = [...selected];
        next[idx] = { ...next[idx], kpt };
        onUpdateSelected(next);
        return;
      }
      if (selected.length < 3) {
        onUpdateSelected([
          ...selected,
          {
            candidate_id: id,
            label: currentPattern.label,
            kpt,
          },
        ]);
        return;
      }
      setLimitModalVisible(true);
    },
    [currentPattern, onUpdateSelected, selected],
  );

  const removeFromSelected = useCallback(
    (candidateId: string) => {
      onUpdateSelected(selected.filter((s) => s.candidate_id !== candidateId));
      setLimitModalVisible(false);
    },
    [onUpdateSelected, selected],
  );

  const onSkipPattern = useCallback(() => {
    if (!currentPattern) return;
    onUpdateSelected(
      selected.filter((s) => s.candidate_id !== currentPattern.candidate_id),
    );
  }, [currentPattern, onUpdateSelected, selected]);

  const onNext = useCallback(() => {
    if (patterns.length === 0) {
      navigation.navigate("CheckinComplete", { selected });
      return;
    }
    const last = currentIndex >= patterns.length - 1;
    if (last) {
      navigation.navigate("CheckinComplete", { selected });
    } else {
      navigation.navigate("CheckinPattern", {
        patterns,
        currentIndex: currentIndex + 1,
        selected,
      });
    }
  }, [currentIndex, navigation, patterns, selected]);

  const onPrev = useCallback(() => {
    if (currentIndex === 0) {
      navigation.goBack();
    } else {
      navigation.navigate("CheckinPattern", {
        patterns,
        currentIndex: currentIndex - 1,
        selected,
      });
    }
  }, [currentIndex, navigation, patterns, selected]);

  if (!currentPattern || patterns.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>표시할 패턴이 없어요</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.emptyBack}>
            <Text style={styles.emptyBackLabel}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isLast = currentIndex >= patterns.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.progressLabel}>
          {currentIndex + 1} / {patterns.length}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>

        <View style={styles.card}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsRow}
          >
            {currentPattern.tags.map((tag, i) => (
              <View
                key={tag}
                style={[styles.tagPill, i > 0 && styles.tagPillGap]}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.label}>{currentPattern.label}</Text>
          <Text style={styles.observation}>{currentPattern.observation}</Text>
          <Text style={styles.interpretation}>
            {currentPattern.interpretation}
          </Text>
        </View>

        <View style={styles.kptBlock}>
          <KptButton
            title="이어가고 싶어요"
            subtitle="괜찮은 흐름이에요"
            selected={currentKpt === "keep"}
            selectedBg={KEEP}
            onPress={() => onSelectKpt("keep")}
          />
          <KptButton
            title="고치고 싶어요"
            subtitle="조금 신경 쓰여요"
            selected={currentKpt === "problem"}
            selectedBg={PROBLEM}
            onPress={() => onSelectKpt("problem")}
          />
          <KptButton
            title="바꿔보고 싶어요"
            subtitle="다르게 해볼게요"
            selected={currentKpt === "try"}
            selectedBg={TRY}
            selectedTextDark
            onPress={() => onSelectKpt("try")}
          />
        </View>

        <Pressable style={styles.skipTextBtn} onPress={onSkipPattern}>
          <Text style={styles.skipText}>이 패턴은 해당 없어요</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.prevBtn} onPress={onPrev}>
          <Text style={styles.prevLabel}>이전으로</Text>
        </Pressable>
        <Pressable style={styles.mainBtn} onPress={onNext}>
          <Text style={styles.mainBtnLabel}>
            {isLast ? "완료하기" : "다음으로"}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={limitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLimitModalVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setLimitModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>이미 3개를 선택했어요</Text>
            <Text style={styles.modalSubtitle}>
              이전 선택을 해제하고 이걸로 바꿀까요?
            </Text>
            {selected.map((item) => (
              <View key={item.candidate_id} style={styles.modalRow}>
                <Text style={styles.modalRowLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Pressable
                  onPress={() => removeFromSelected(item.candidate_id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} 선택 해제`}
                >
                  <Text style={styles.modalX}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.modalCancel}
              onPress={() => setLimitModalVisible(false)}
            >
              <Text style={styles.modalCancelLabel}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type KptButtonProps = {
  title: string;
  subtitle: string;
  selected: boolean;
  selectedBg: string;
  selectedTextDark?: boolean;
  onPress: () => void;
};

function KptButton({
  title,
  subtitle,
  selected,
  selectedBg,
  selectedTextDark,
  onPress,
}: KptButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.kptBtn,
        selected
          ? { backgroundColor: selectedBg, borderColor: selectedBg }
          : { backgroundColor: "rgba(255,255,255,0.1)" },
      ]}
    >
      <Text
        style={[
          styles.kptTitle,
          selected && selectedTextDark ? styles.kptTitleDark : undefined,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.kptSub,
          selected && selectedTextDark ? styles.kptSubDark : undefined,
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },
  progressLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  tagsRow: {
    flexDirection: "row",
    paddingBottom: 12,
    flexWrap: "nowrap",
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  tagPillGap: {
    marginLeft: 8,
  },
  kptBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  kptTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  kptTitleDark: {
    color: TRY_TEXT,
  },
  kptSub: {
    fontSize: 13,
    marginTop: 4,
    color: "rgba(255,255,255,0.85)",
  },
  kptSubDark: {
    color: TRY_TEXT,
    opacity: 0.85,
  },
  tagText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  observation: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  interpretation: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  kptBlock: {
    marginBottom: 12,
  },
  skipTextBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  prevBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },
  prevLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    opacity: 0.85,
  },
  mainBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  mainBtnLabel: {
    color: "#2E7FC1",
    fontSize: 17,
    fontWeight: "700",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  emptyBack: {
    marginTop: 16,
    padding: 12,
  },
  emptyBackLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    textDecorationLine: "underline",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 0,
  },
  modalSheet: {
    width: "100%",
    zIndex: 1,
    backgroundColor: "#1A2F4A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.25)",
  },
  modalRowLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    marginRight: 12,
  },
  modalX: {
    color: "#FFFFFF",
    fontSize: 18,
    opacity: 0.9,
  },
  modalCancel: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  modalCancelLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
