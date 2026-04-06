import { AppText } from "../../../components/AppText";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import type { CalendarDay } from "../../report/types";

const MAIN = "#2E7FC1";
const WEEK_ROW_BG = "#E6F1FB";
const CARD_GAP = 12;
const PANEL_H = 248;

/** 캘린더 카드 미리보기용 — TODO: API 요약 필드로 교체 */
const MOCK_CARD_DAILY_SUMMARY = "밤 시간 사용이 조금 길었던 날이에요";
const MOCK_CARD_WEEKLY_LINE = "평균 밸런스 72 · 체크인 5회";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type Props = NativeStackScreenProps<MainStackParamList, "Calendar">;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameWeekSunday(a: Date, b: Date): boolean {
  return startOfWeekSunday(a).getTime() === startOfWeekSunday(b).getTime();
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, month - 1, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function weekRowIndexForDate(year: number, month: number, d: Date): number {
  const grid = buildMonthGrid(year, month);
  const key = toDateKey(d);
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    for (const cell of row) {
      if (cell && toDateKey(cell) === key) return r + 1;
    }
  }
  return 1;
}

function weekRangeFromDate(d: Date): {
  weekId: string;
  startDate: string;
  endDate: string;
} {
  const start = startOfWeekSunday(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sd = toDateKey(start);
  const ed = toDateKey(end);
  return { weekId: `${sd}_${ed}`, startDate: sd, endDate: ed };
}

/**
 * TODO: GET /calendar/summary?year=N&month=N 연동 시 이 함수 제거하고 API 응답으로 교체
 */
async function loadMockCalendarMonth(
  year: number,
  month: number,
): Promise<CalendarDay[]> {
  await new Promise<void>((r) => setTimeout(r, 320));
  const today = new Date();
  const lastDay = new Date(year, month, 0).getDate();
  const out: CalendarDay[] = [];
  for (let d = 1; d <= lastDay; d += 1) {
    const date = new Date(year, month - 1, d);
    const key = toDateKey(date);
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    const weekly = isSameWeekSunday(date, today);
    out.push({
      date: key,
      has_daily_report: isToday,
      has_weekly_report: weekly,
    });
  }
  return out;
}

export function CalendarScreen({ navigation }: Props) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    y: today.getFullYear(),
    m: today.getMonth() + 1,
  }));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const slideY = useRef(new Animated.Value(PANEL_H)).current;

  const loadMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      // TODO: GET /calendar/summary?year=&month= → getCalendarSummary(year, month)
      const list = await loadMockCalendarMonth(year, month);
      setDays(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth(cursor.y, cursor.m);
  }, [cursor.y, cursor.m, loadMonth]);

  useEffect(() => {
    setSelectedKey(null);
  }, [cursor.y, cursor.m]);

  const dayMap = useMemo(() => {
    const m: Record<string, CalendarDay> = {};
    for (const d of days) m[d.date] = d;
    return m;
  }, [days]);

  const grid = useMemo(
    () => buildMonthGrid(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  useEffect(() => {
    const show = selectedKey !== null;
    Animated.timing(slideY, {
      toValue: show ? 0 : PANEL_H,
      duration: show ? 280 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedKey, slideY]);

  const onSelectDate = useCallback((d: Date) => {
    setSelectedKey(toDateKey(d));
  }, []);

  const selectedMeta = useMemo(() => {
    if (!selectedKey) return null;
    const d = parseDateKey(selectedKey);
    const info = dayMap[selectedKey];
    const wk = weekRangeFromDate(d);
    const weekNum = weekRowIndexForDate(cursor.y, cursor.m, d);
    return { d, info, wk, weekNum };
  }, [selectedKey, dayMap, cursor.y, cursor.m]);

  const prevMonth = useCallback(() => {
    setCursor((c) => {
      if (c.m === 1) return { y: c.y - 1, m: 12 };
      return { y: c.y, m: c.m - 1 };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCursor((c) => {
      if (c.m === 12) return { y: c.y + 1, m: 1 };
      return { y: c.y, m: c.m + 1 };
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backWrap}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <AppText style={styles.back}>←</AppText>
        </Pressable>
        <AppText style={styles.headerTitle}>기록 보관함</AppText>
        <View style={styles.backWrap} />
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={prevMonth} style={styles.monthArrow} hitSlop={8}>
          <AppText style={styles.monthArrowText}>{"<"}</AppText>
        </Pressable>
        <AppText style={styles.monthLabel}>
          {cursor.y}년 {cursor.m}월
        </AppText>
        <Pressable onPress={nextMonth} style={styles.monthArrow} hitSlop={8}>
          <AppText style={styles.monthArrowText}>{">"}</AppText>
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {WEEKDAYS.map((w) => (
          <AppText key={w} style={styles.weekHeaderCell}>
            {w}
          </AppText>
        ))}
      </View>

      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.gridScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={MAIN} />
          </View>
        ) : (
          grid.map((row, ri) => {
            const rowHasWeekly = row.some(
              (cell) =>
                cell !== null && (dayMap[toDateKey(cell)]?.has_weekly_report ?? false),
            );
            return (
              <View
                key={`row-${ri}`}
                style={[styles.row, rowHasWeekly && styles.rowWeekly]}
              >
                {row.map((cell, ci) => {
                  if (!cell) {
                    return <View key={`e-${ri}-${ci}`} style={styles.cell} />;
                  }
                  const key = toDateKey(cell);
                  const meta = dayMap[key];
                  const isToday =
                    cell.getFullYear() === today.getFullYear() &&
                    cell.getMonth() === today.getMonth() &&
                    cell.getDate() === today.getDate();
                  const selected = key === selectedKey;
                  return (
                    <Pressable
                      key={key}
                      style={styles.cell}
                      onPress={() => onSelectDate(cell)}
                      accessibilityRole="button"
                      accessibilityLabel={`${cell.getMonth() + 1}월 ${cell.getDate()}일`}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          !isToday && styles.dayInnerBg,
                          isToday && styles.dayToday,
                          selected && styles.daySelected,
                        ]}
                      >
                        <AppText
                          style={[
                            styles.dayNum,
                            isToday && styles.dayNumToday,
                            !isToday && styles.dayNumDefault,
                          ]}
                        >
                          {cell.getDate()}
                        </AppText>
                        {meta?.has_daily_report ? (
                          <View style={styles.dot} />
                        ) : (
                          <View style={styles.dotPlaceholder} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      <Animated.View
        style={[
          styles.panel,
          { height: PANEL_H, transform: [{ translateY: slideY }] },
        ]}
        pointerEvents={selectedKey ? "auto" : "none"}
      >
        {selectedMeta ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.panelScroll}
          >
            <View style={styles.card}>
              <AppText style={styles.cardEmoji}>📅</AppText>
              <AppText style={styles.cardTitle}>
                {selectedMeta.d.getMonth() + 1}월 {selectedMeta.d.getDate()}일
                {selectedMeta.info?.has_daily_report
                  ? " 일간 리포트"
                  : ""}
              </AppText>
              {selectedMeta.info?.has_daily_report ? (
                <>
                  <AppText style={styles.cardSummary} numberOfLines={2}>
                    {MOCK_CARD_DAILY_SUMMARY}
                  </AppText>
                  <Pressable
                    onPress={() =>
                      navigation.navigate("DailyReport", {
                        date: toDateKey(selectedMeta.d),
                      })
                    }
                    style={styles.cardLink}
                  >
                    <AppText style={styles.cardLinkText}>자세히 보기 →</AppText>
                  </Pressable>
                </>
              ) : (
                <AppText style={styles.cardEmpty}>아직 기록이 없어요</AppText>
              )}
            </View>

            <View style={[styles.card, { marginTop: CARD_GAP }]}>
              <AppText style={styles.cardEmoji}>📊</AppText>
              <AppText style={styles.cardTitle}>
                {selectedMeta.d.getMonth() + 1}월 {selectedMeta.weekNum}주차
                {selectedMeta.info?.has_weekly_report
                  ? " 주간 리포트"
                  : ""}
              </AppText>
              {selectedMeta.info?.has_weekly_report ? (
                <>
                  <AppText style={styles.cardSummary}>
                    {MOCK_CARD_WEEKLY_LINE}
                  </AppText>
                  <Pressable
                    onPress={() =>
                      navigation.navigate("WeeklyReport", {
                        weekId: selectedMeta.wk.weekId,
                        startDate: selectedMeta.wk.startDate,
                        endDate: selectedMeta.wk.endDate,
                      })
                    }
                    style={styles.cardLink}
                  >
                    <AppText style={styles.cardLinkText}>자세히 보기 →</AppText>
                  </Pressable>
                </>
              ) : (
                <AppText style={styles.cardEmpty}>아직 기록이 없어요</AppText>
              )}
            </View>
          </ScrollView>
        ) : null}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backWrap: {
    width: 44,
    justifyContent: "center",
  },
  back: {
    fontSize: 24,
    color: "#1A1A2E",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,

    color: "#1A1A2E",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 20,
  },
  monthArrow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  monthArrowText: {
    fontSize: 20,
    color: MAIN,

  },
  monthLabel: {
    fontSize: 18,

    color: "#1A1A2E",
    minWidth: 120,
    textAlign: "center",
  },
  weekHeader: {
    flexDirection: "row",
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  weekHeaderCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#888888",

  },
  gridScroll: {
    flex: 1,
  },
  gridScrollContent: {
    paddingHorizontal: 8,
    paddingBottom: PANEL_H + 16,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  rowWeekly: {
    backgroundColor: WEEK_ROW_BG,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  dayInner: {
    width: 44,
    height: 52,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayInnerBg: {
    backgroundColor: "#FFFFFF",
  },
  dayToday: {
    backgroundColor: MAIN,
  },
  daySelected: {
    borderColor: MAIN,
  },
  dayNum: {
    fontSize: 15,

  },
  dayNumToday: {
    color: "#FFFFFF",
  },
  dayNumDefault: {
    color: "#1A1A2E",
  },
  dot: {
    marginTop: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: MAIN,
  },
  dotPlaceholder: {
    marginTop: 4,
    height: 5,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F5F7FA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    paddingTop: 12,
  },
  panelScroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    padding: 16,
  },
  cardEmoji: {
    fontSize: 20,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,

    color: "#1A1A2E",
    marginBottom: 8,
  },
  cardSummary: {
    fontSize: 14,
    color: "#555555",
    lineHeight: 20,
    marginBottom: 10,
  },
  cardEmpty: {
    fontSize: 14,
    color: "#888888",
  },
  cardLink: {
    alignSelf: "flex-start",
  },
  cardLinkText: {
    fontSize: 15,

    color: MAIN,
  },
});
