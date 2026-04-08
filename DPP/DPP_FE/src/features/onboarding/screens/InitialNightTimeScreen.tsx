// 심야 시간 원형 선택 (PanResponder + SVG 호)
import { AppText } from "../../../components/AppText";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
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
import {
  DEFAULT_CHECKIN_WINDOW_MINUTES,
  deriveCheckinTimeFromNightStart,
  formatHhMm,
} from "../../checkin/utils/checkinPolicy";
import { syncNativeUsagePolicy } from "../../usage/services/dailyUsage";
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

function parseHour(value: string, fallback: number): number {
  const match = /^(\d{1,2})(?::\d{2})?$/.exec(value.trim());
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
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
type HourOption = {
  hour: number;
  label: string;
};

const CHECKIN_TIME_OPTIONS: HourOption[] = [
  { hour: 19, label: "19:00" },
  { hour: 20, label: "20:00" },
  { hour: 21, label: "21:00" },
  { hour: 22, label: "22:00" },
  { hour: 23, label: "23:00" },
  { hour: 0, label: "00:00" },
  { hour: 1, label: "01:00" },
  { hour: 2, label: "02:00" },
];

const WINDOW_OPTIONS = [60, 120, 180];

function describeCheckinWindow(checkinHour: number, windowMinutes: number): string {
  const start = checkinHour * 60;
  const end = (start + windowMinutes) % 1440;
  return `${formatHhMm(Math.floor(start / 60), start % 60)} - ${formatHhMm(
    Math.floor(end / 60),
    end % 60,
  )}`;
}

export function InitialNightTimeScreen({ navigation, route }: Props) {
  const isEdit = route.params?.isEditMode === true;
  const setOnboardingData = useAuthStore((s) => s.setOnboardingData);
  const draft = useAuthStore.getState().onboardingData;
  const [startHour, setStartHour] = useState(() =>
    initialNightHours(draft).start,
  );
  const [endHour, setEndHour] = useState(() =>
    initialNightHours(draft).end,
  );
  const [checkinHour, setCheckinHour] = useState(() =>
    parseHour(
      draft.checkin_time || deriveCheckinTimeFromNightStart(draft.night_mode_start),
      21,
    ),
  );
  const [windowMinutes, setWindowMinutes] = useState(() =>
    typeof draft.checkin_window_minutes === "number" && draft.checkin_window_minutes > 0
      ? draft.checkin_window_minutes
      : DEFAULT_CHECKIN_WINDOW_MINUTES,
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
  const checkinWindowLabel = useMemo(
    () => describeCheckinWindow(checkinHour, windowMinutes),
    [checkinHour, windowMinutes],
  );

  const onNext = useCallback(async () => {
    setLoading(true);
    try {
      const nightModeStart = formatHour(startHour);
      const nightModeEnd = formatHour(endHour);
      const checkinTime = formatHour(checkinHour);
      const dayRolloverTime = checkinTime;
      await setOnboardingData({
        night_mode_start: nightModeStart,
        night_mode_end: nightModeEnd,
        checkin_time: checkinTime,
        checkin_window_minutes: windowMinutes,
        day_rollover_time: dayRolloverTime,
      });
      await syncNativeUsagePolicy();
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
  }, [
    checkinHour,
    endHour,
    isEdit,
    navigation,
    setOnboardingData,
    startHour,
    windowMinutes,
  ]);

  const onSkip = useCallback(() => {
    (
      navigation as NativeStackNavigationProp<OnboardingStackParamList>
    ).navigate("InitialStruggles");
  }, [navigation]);

  const onPressNext = useCallback(() => {
    onNext().catch(() => {
      // onNext 내부에서 사용자 안내를 마친다.
    });
  }, [onNext]);

  return (
    <OnboardingStepLayout
      step={3}
      hideProgress={isEdit}
      title="심야와 하루 마감 시간을 설정해주세요"
      subtitle="하루를 언제 돌아볼지 정하면, 그 시각에 하루가 마감되고 체크인이 열려요"
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
          onPress={onPressNext}
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          <AppText style={styles.legendText}>🌙 심야</AppText>
        </View>

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>체크인 오픈 시간 설정</AppText>
          <AppText style={styles.sectionHint}>
            하루가 마감되고, 체크인이 열리는 시각을 설정할 수 있어요.
          </AppText>
          <View style={styles.optionWrap}>
            {CHECKIN_TIME_OPTIONS.map((option) => {
              const selected = option.hour === checkinHour;
              return (
                <Pressable
                  key={option.hour}
                  style={[styles.optionChip, selected && styles.optionChipOn]}
                  onPress={() => setCheckinHour(option.hour)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <AppText style={[styles.optionChipText, selected && styles.optionChipTextOn]}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>체크인 허용 시간창</AppText>
          <AppText style={styles.sectionHint}>
            하루를 마감하고, 몇 시간동안 체크인을 허용할지 정할 수 있어요.
          </AppText>
          <View style={styles.optionWrap}>
            {WINDOW_OPTIONS.map((option) => {
              const selected = option === windowMinutes;
              return (
                <Pressable
                  key={option}
                  style={[styles.optionChip, selected && styles.optionChipOn]}
                  onPress={() => setWindowMinutes(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <AppText style={[styles.optionChipText, selected && styles.optionChipTextOn]}>
                    {Math.round(option / 60)}시간
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>! 하루 마감 기준 !</AppText>
          <AppText style={styles.sectionHint}>
            하루가 마감되면 체크인이 열리는 시각이 되어요. 지금 설정이면 매일{" "}
            {formatHour(checkinHour)}에 하루가 마감되고, {checkinWindowLabel} 동안 체크인을 통해 하루 회고를 진행할 수 있어요.
          </AppText>
        </View>
      </ScrollView>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 16,
  },
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
  sectionCard: {
    marginHorizontal: 24,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E1EAF3",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#1C2B39",
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5A6B7B",
    marginBottom: 12,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C9D7E5",
    backgroundColor: "#FFFFFF",
  },
  optionChipOn: {
    backgroundColor: MAIN,
    borderColor: MAIN,
  },
  optionChipText: {
    fontSize: 13,
    color: "#395168",
  },
  optionChipTextOn: {
    color: "#FFFFFF",
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
