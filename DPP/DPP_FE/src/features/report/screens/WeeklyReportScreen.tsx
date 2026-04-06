import { AppText } from "../../../components/AppText";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { getWeeklyReport } from "../../../services/api/report.api";
import type { WeeklyReportData } from "../types";

const MAIN = "#2E7FC1";
const BG = "#F5F7FA";
const CARD_GAP = 12;
const TITLE = "#1A1A2E";
const GREEN = "#1D9E75";
const ORANGE_PILL = "#FFB347";
const HIGHLIGHT_BLUE = "#E6F1FB";

type Props = NativeStackScreenProps<MainStackParamList, "WeeklyReport">;

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** start_date 기준 헤더: "N월 N주차 리포트", 주차 = Math.ceil(getDate() / 7) */
function formatHeaderTitle(startDate: string): string {
  const d = parseDateKey(startDate);
  const month = d.getMonth() + 1;
  const weekNum = Math.ceil(d.getDate() / 7);
  return `${month}월 ${weekNum}주차 리포트`;
}

/** 카드 1 부제: "N월 N일 - N일" */
function formatWeekRangeSubtitle(startDate: string, endDate: string): string {
  const a = parseDateKey(startDate);
  const b = parseDateKey(endDate);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getMonth() + 1}월 ${a.getDate()}일 - ${b.getDate()}일`;
  }
  return `${a.getMonth() + 1}월 ${a.getDate()}일 - ${b.getMonth() + 1}월 ${b.getDate()}일`;
}

export function WeeklyReportScreen({ navigation, route }: Props) {
  const { startDate } = route.params;
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await getWeeklyReport(startDate);
        if (alive) {
          setData(next);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "주간 리포트를 불러오지 못했어요.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [startDate]);

  if (loading || !data) {
    if (!loading && error) {
      return (
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.loadingWrap}>
            <AppText style={styles.errorText}>{error}</AppText>
            <Pressable onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
              <AppText style={styles.errorBackLabel}>돌아가기</AppText>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={MAIN} />
        </View>
      </SafeAreaView>
    );
  }

  const headerTitle = formatHeaderTitle(data.start_date);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <AppText style={styles.backArrow}>←</AppText>
        </Pressable>
        <AppText style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 카드 1 — 이번 주 타이틀 */}
        <View style={[styles.card, styles.cardTitleBlock]}>
          <AppText style={styles.card1Subtitle}>
            {formatWeekRangeSubtitle(data.start_date, data.end_date)}
          </AppText>
          <AppText style={styles.card1Title}>이번 주 바다 탐험</AppText>
          {data.badge ? (
            <View style={styles.badgePill}>
              <AppText style={styles.badgeText}>{data.badge}</AppText>
            </View>
          ) : null}
        </View>

        {/* 카드 2 — 수치 요약 */}
        <View style={[styles.card, styles.cardMargin, styles.statsGrid]}>
          <View style={styles.statCol}>
            <AppText style={styles.statLabel}>평균 도파민 밸런스</AppText>
            <AppText style={styles.statNumBlue}>{data.avg_balance_score}</AppText>
          </View>
          <View style={styles.statCol}>
            <AppText style={styles.statLabel}>체크인 횟수</AppText>
            <AppText style={styles.statNumGreen}>{data.checkin_count}</AppText>
            <AppText style={styles.statSub}>{`${data.checkin_count}/7일`}</AppText>
          </View>
        </View>

        {/* 카드 3 — 주요 활동 시간 */}
        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.card3Label}>주요 활동 시간</AppText>
          <AppText style={styles.card3Value}>{data.main_activity_time}</AppText>
        </View>

        {/* 카드 4 — 주세 분석 */}
        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.sectionTitle}>주세 분석</AppText>
          <View style={styles.aiSubcard}>
            <View style={styles.aiSubcardRow}>
              <View style={styles.aiIconCircle} />
              <View style={styles.aiSubcardTextWrap}>
                <AppText style={styles.aiSubcardSummary}>{data.ai_summary}</AppText>
                <AppText style={styles.aiSubcardHint}>전주 대비</AppText>
              </View>
            </View>
          </View>
          <View style={styles.divider} />
          <AppText style={styles.smallLabel}>가장 충실한 날</AppText>
          <AppText style={styles.analysisValue}>{data.best_day}</AppText>
          <AppText style={styles.analysisComment}>{data.best_day_comment}</AppText>
          <View style={styles.divider} />
          <AppText style={styles.smallLabel}>개선이 필요한 영역</AppText>
          <AppText style={styles.analysisValue}>{data.improve_area}</AppText>
          <AppText style={styles.analysisComment}>{data.improve_area_comment}</AppText>
        </View>

        {/* 카드 5 — 돌고래의 관찰 */}
        <View style={[styles.card, styles.cardMargin, styles.cardDolphin]}>
          <View style={styles.dolphinTitleRow}>
            <AppText style={styles.dolphinEmoji}>🐬</AppText>
            <AppText style={styles.dolphinTitle}>돌고래의 관찰</AppText>
          </View>
          {data.dolphin_observations.map((line, i) => (
            <AppText
              key={`d-${i}`}
              style={[styles.bulletLine, i > 0 && styles.bulletGap]}
            >
              <AppText style={styles.bulletDot}>• </AppText>
              <AppText style={styles.bulletText}>{line}</AppText>
            </AppText>
          ))}
        </View>

        {/* 카드 6 — 다음 주를 위한 제안 */}
        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.sectionTitle}>다음 주를 위한 제안</AppText>
          {data.next_week_suggestions.map((line, i) => (
            <AppText
              key={`s-${i}`}
              style={[styles.bulletLine, i > 0 && styles.bulletGap]}
            >
              <AppText style={styles.bulletDot}>• </AppText>
              <AppText style={styles.bulletText}>{line}</AppText>
            </AppText>
          ))}
        </View>

        {/* 카드 7 — AI 상세 코멘트 */}
        <View style={[styles.card, styles.cardMargin, styles.cardAiFooter]}>
          <AppText style={styles.sectionTitle}>이번 주 돌아보기</AppText>
          <AppText style={styles.aiCommentBody}>{data.ai_comment}</AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: TITLE,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  errorBackBtn: {
    marginTop: 16,
    backgroundColor: MAIN,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  errorBackLabel: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backArrow: {
    fontSize: 24,
    color: TITLE,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    color: TITLE,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
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
  cardMargin: {
    marginTop: CARD_GAP,
  },
  cardTitleBlock: {
    backgroundColor: HIGHLIGHT_BLUE,
  },
  card1Subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  card1Title: {
    fontSize: 28,
    color: TITLE,
    lineHeight: 36,
  },
  badgePill: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: ORANGE_PILL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    color: TITLE,
  },
  statsGrid: {
    flexDirection: "row",
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 8,
  },
  statNumBlue: {
    fontSize: 36,
    color: MAIN,
  },
  statNumGreen: {
    fontSize: 36,
    color: GREEN,
  },
  statSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#888888",
  },
  card3Label: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 8,
  },
  card3Value: {
    fontSize: 18,
    color: MAIN,
  },
  sectionTitle: {
    fontSize: 16,
    color: TITLE,
    marginBottom: 12,
  },
  aiSubcard: {
    backgroundColor: "#EEEEEE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  aiSubcardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  aiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#C8EBD4",
    marginRight: 12,
  },
  aiSubcardTextWrap: {
    flex: 1,
  },
  aiSubcardSummary: {
    fontSize: 16,
    color: TITLE,
    lineHeight: 22,
  },
  aiSubcardHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#888888",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E0E0E0",
    marginVertical: 14,
  },
  smallLabel: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 6,
  },
  analysisValue: {
    fontSize: 22,
    color: TITLE,
    marginBottom: 6,
  },
  analysisComment: {
    fontSize: 14,
    color: "#888888",
    lineHeight: 20,
  },
  cardDolphin: {
    backgroundColor: HIGHLIGHT_BLUE,
  },
  dolphinTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dolphinEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  dolphinTitle: {
    fontSize: 16,
    color: TITLE,
  },
  bulletLine: {},
  bulletGap: {
    marginTop: 8,
  },
  bulletDot: {
    color: MAIN,
  },
  bulletText: {
    fontSize: 15,
    color: "#444444",
    lineHeight: 22,
  },
  cardAiFooter: {
    backgroundColor: BG,
  },
  aiCommentBody: {
    fontSize: 15,
    color: "#444444",
    lineHeight: 24,
  },
});
