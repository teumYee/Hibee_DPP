// 심야 시간 원형 선택 (PanResponder + SVG 호)
import { AppText } from "../../../components/AppText";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
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
import { type OnboardingDraft, useAuthStore } from "../../../store/auth.store";
import { OnboardingStepLayout } from "../components/OnboardingStepLayout";

function initialNightHours(draft: OnboardingDraft): { start: number; end: number } {
  const sh = /^(\d{1,2}):00$/.exec(draft.night_mode_start.trim());
  const eh = /^(\d{1,2}):00$/.exec(draft.night_mode_end.trim());
  const parse = (m: RegExpExecArray | null): number | null => {
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n < 0 || n > 23) return null;
    return n;
  };
  const start = parse(sh) ?? 22;
  const end = parse(eh) ?? 6;
  return { start, end };
}

type Props =
  | NativeStackScreenProps<OnboardingStackParamList, "InitialNightTime">
  | NativeStackScreenProps<MainStackParamList, "SettingsEditNightTime">;

const MAIN = "#2E7FC1";
const NAVY = "#0D2E5C";
const BG = "#FFFFFF";
const SKIP = "#6C7A89";

function hourToRad(hour: number): number {
  return (hour / 24) * 2 * Math.PI - Math.PI / 2;
}

function snapHourFromXY(
  x: number,
  y: number,
  cx: number,
  cy: number,
): number {
  const angle = Math.atan2(y - cy, x - cx);
  let h = ((angle + Math.PI / 2) / (2 * Math.PI)) * 24;
  h = Math.round(h);
  if (h < 0) h += 24;
  if (h >= 24) h -= 24;
  return h;
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startHour: number,
  endHour: number,
): string {
  const sweepHours =
    endHour >= startHour ? endHour - startHour : 24 - startHour + endHour;
  const sweepRad = (sweepHours / 24) * 2 * Math.PI;
  const startAngle = hourToRad(startHour);
  const endAngle = startAngle + sweepRad;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = sweepRad > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

type DragHandle = "start" | "end";

export function InitialNightTimeScreen({ navigation, route }: Props) {
  const isEdit = route.params?.isEditMode === true;
  const setOnboardingData = useAuthStore((s) => s.setOnboardingData);
  const [startHour, setStartHour] = useState(() =>
    initialNightHours(useAuthStore.getState().onboardingData).start,
  );
  const [endHour, setEndHour] = useState(() =>
    initialNightHours(useAuthStore.getState().onboardingData).end,
  );
  const [loading, setLoading] = useState(false);

  const size = Math.min(Dimensions.get("window").width - 48, 300);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rArc = rOuter - 6;
  const rHandle = 12;

  const dragRef = useRef<DragHandle | null>(null);
  const hoursRef = useRef({ startHour, endHour });
  hoursRef.current = { startHour, endHour };

  const arcPath = useMemo(
    () => describeArc(cx, cy, rArc, startHour, endHour),
    [cx, cy, rArc, startHour, endHour],
  );

  const posStart = useMemo(() => {
    const a = hourToRad(startHour);
    return {
      left: cx + rArc * Math.cos(a) - rHandle,
      top: cy + rArc * Math.sin(a) - rHandle,
    };
  }, [cx, cy, rArc, startHour]);

  const posEnd = useMemo(() => {
    const sweepHours =
      endHour >= startHour ? endHour - startHour : 24 - startHour + endHour;
    const sweepRad = (sweepHours / 24) * 2 * Math.PI;
    const a = hourToRad(startHour) + sweepRad;
    return {
      left: cx + rArc * Math.cos(a) - rHandle,
      top: cy + rArc * Math.sin(a) - rHandle,
    };
  }, [cx, cy, rArc, startHour, endHour]);

  const handleMove = useCallback(
    (lx: number, ly: number) => {
      const h = snapHourFromXY(lx, ly, cx, cy);
      if (dragRef.current === "start") setStartHour(h);
      if (dragRef.current === "end") setEndHour(h);
    },
    [cx, cy],
  );

  const pan = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { startHour: sh, endHour: eh } = hoursRef.current;
        const startAngle = hourToRad(sh);
        const sweepHours = eh >= sh ? eh - sh : 24 - sh + eh;
        const sweepRad = (sweepHours / 24) * 2 * Math.PI;
        const endAngle = startAngle + sweepRad;
        const sx = cx + rArc * Math.cos(startAngle) - rHandle;
        const sy = cy + rArc * Math.sin(startAngle) - rHandle;
        const ex = cx + rArc * Math.cos(endAngle) - rHandle;
        const ey = cy + rArc * Math.sin(endAngle) - rHandle;
        const lx = evt.nativeEvent.locationX;
        const ly = evt.nativeEvent.locationY;
        const distS = Math.hypot(lx - (sx + rHandle), ly - (sy + rHandle));
        const distE = Math.hypot(lx - (ex + rHandle), ly - (ey + rHandle));
        dragRef.current = distS <= distE ? "start" : "end";
      },
      onPanResponderMove: (evt) => {
        handleMove(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderRelease: () => {
        dragRef.current = null;
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
      },
    });
  }, [cx, cy, rArc, rHandle, handleMove]);

  const rangeLabel = useMemo(
    () => `${formatHour(startHour)} - ${formatHour(endHour)}`,
    [startHour, endHour],
  );

  const onNext = useCallback(async () => {
    setLoading(true);
    try {
      await setOnboardingData({
        night_mode_start: formatHour(startHour),
        night_mode_end: formatHour(endHour),
      });
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
        ).navigate("InitialStruggles");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "저장에 실패했어요";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  }, [endHour, isEdit, navigation, setOnboardingData, startHour]);

  const onSkip = useCallback(() => {
    (
      navigation as NativeStackNavigationProp<OnboardingStackParamList>
    ).navigate("InitialStruggles");
  }, [navigation]);

  return (
    <OnboardingStepLayout
      step={3}
      hideProgress={isEdit}
      title="심야 시간을 설정해주세요"
      subtitle="이 시간대, 조금 더 여유롭게 관찰해요"
      onBack={() => navigation.goBack()}
      headerRight={
        !isEdit ? (
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <AppText style={styles.skipText}>건너뛰기</AppText>
          </Pressable>
        ) : undefined
      }
      footer={
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            loading && styles.primaryBtnDisabled,
            pressed && !loading && styles.primaryBtnPressed,
          ]}
          onPress={() => void onNext()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? "저장하기" : "완료하기"}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AppText style={styles.primaryBtnText}>
              {isEdit ? "저장하기" : "완료하기"}
            </AppText>
          )}
        </Pressable>
      }
    >
      <View
        style={[styles.clockWrap, { height: size + 32 }]}
        collapsable={false}
        {...pan.panHandlers}
      >
        <Svg width={size} height={size} style={styles.svg}>
          <Circle cx={cx} cy={cy} r={rOuter} fill={NAVY} />
          <Path d={arcPath} stroke={MAIN} strokeWidth={10} fill="none" />
        </Svg>
        <View
          pointerEvents="none"
          style={[styles.centerLabel, { width: size, height: size }]}
        >
          <AppText style={styles.rangeText}>{rangeLabel}</AppText>
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.handle,
            { left: posStart.left, top: posStart.top, width: rHandle * 2, height: rHandle * 2 },
          ]}
        >
          <View style={styles.handleInner} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.handle,
            { left: posEnd.left, top: posEnd.top, width: rHandle * 2, height: rHandle * 2 },
          ]}
        >
          <View style={styles.handleInner} />
        </View>
      </View>

      <View style={styles.legend}>
        <AppText style={styles.legendText}>🕐 시간</AppText>
        <View style={styles.legendSwatch} />
        <AppText style={styles.legendText}>🌙</AppText>
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  clockWrap: {
    alignSelf: "center",
    marginBottom: 16,
  },
  svg: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  centerLabel: {
    position: "absolute",
    left: 0,
    top: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  rangeText: {
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  handle: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  handleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: MAIN,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  legendText: {
    fontSize: 14,
    color: "#555555",
  },
  legendSwatch: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: MAIN,
  },
  primaryBtn: {
    backgroundColor: MAIN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnPressed: {
    opacity: 0.92,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
  },
  skipText: {
    color: SKIP,
    fontSize: 14,
  },
});
