import { AppText } from "../../../components/AppText";
import { LoadingOverlay } from "../../../components/LoadingOverlay";
import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { getDailyReportByDate } from "../../../services/api/report.api";
import { formatMinutes } from "../../dashboard/utils/formatMinutes";
import {
  DonutCategoryChart,
  HorizontalBarList,
  MetricGrid,
  TimelineBarChart,
  TimeFlowChart,
} from "../components/ReportVisuals";
import type { DailyReportData } from "../types";

const MAIN = "#2E7FC1";
const BG = "#F5F7FA";
const CARD_GAP = 12;
const TITLE = "#1A1A2E";
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

type Props = NativeStackScreenProps<MainStackParamList, "DailyReport">;

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatKoreanLongDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const weekday = WEEKDAYS_KO[date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}요일`;
}

export function DailyReportScreen({ navigation, route }: Props) {
  const [data, setData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartWidth = Dimensions.get("window").width - 64;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await getDailyReportByDate(route.params.date);
        if (alive) {
          setData(next);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "리포트를 불러오지 못했어요.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [route.params.date]);

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
        <View style={styles.loadingWrap} />
        <LoadingOverlay
          visible
          title="리포트를 불러오고 있어요"
          message="오늘의 시각 지표와 회고 내용을 준비하는 중이에요."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backWrap}>
          <AppText style={styles.backText}>← 목록으로</AppText>
        </Pressable>
        <AppText style={styles.headerTitle}>하루의 기록</AppText>
        <View style={styles.backWrap} />
      </View>
      <AppText style={styles.dateLine}>{formatKoreanLongDate(data.date)}</AppText>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.cardHighlight]}>
          <AppText style={styles.moon}>🌙</AppText>
          <AppText style={styles.aiSummary}>{data.ai_summary}</AppText>
          <AppText style={styles.aiSub}>완료된 하루를 기준으로 정리한 리포트예요.</AppText>
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>오늘의 핵심 수치</AppText>
          <MetricGrid items={data.metrics} />
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>시간의 흐름</AppText>
          <TimeFlowChart buckets={data.time_buckets} width={chartWidth} height={200} />
          <AppText style={styles.chartCaption}>하루 동안의 기기 사용 흐름</AppText>
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>시간대별 사용 비중</AppText>
          <HorizontalBarList
            items={data.time_of_day_usage.map((item) => ({
              key: item.name,
              title: item.name,
              amount: item.minutes,
              color: item.color,
            }))}
            emptyText="시간대별 사용 데이터가 없어요."
          />
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>카테고리 사용</AppText>
          <DonutCategoryChart items={data.category_usage.slice(0, 5)} />
          <HorizontalBarList
            items={data.category_usage.map((item) => ({
              key: item.name,
              title: item.name,
              amount: item.minutes,
              color: item.color,
              meta:
                item.app_count || item.launch_count
                  ? `앱 ${item.app_count || 0}개 · 실행 ${item.launch_count || 0}회`
                  : undefined,
            }))}
            emptyText="카테고리 사용 데이터가 없어요."
          />
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>많이 본 앱</AppText>
          <HorizontalBarList
            items={data.top_apps.map((item, index) => ({
              key: `${item.name}-${index}`,
              title: item.name,
              amount: item.minutes,
              color: ["#2E7FC1", "#FFB347", "#8A6FE8", "#1D9E75", "#E85D24"][index % 5],
              meta: item.category
                ? `${item.category} · 실행 ${item.launch_count}회`
                : `실행 ${item.launch_count}회`,
            }))}
            emptyText="앱 사용 데이터가 아직 부족해요."
          />
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>세부 타임라인</AppText>
          <TimelineBarChart items={data.timeline_usage} />
          <AppText style={styles.chartCaption}>
            {data.timeline_usage.length > 0
              ? `가장 긴 구간은 ${formatMinutes(
                  Math.max(...data.timeline_usage.map((item) => item.minutes)),
                )}이에요.`
              : "시간대 구간 데이터가 없어요."}
          </AppText>
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <AppText style={styles.cardTitle}>오늘의 다짐</AppText>
          {data.kpt_items.length === 0 ? (
            <AppText style={styles.kptEmpty}>오늘은 체크인을 패스했어요</AppText>
          ) : (
            data.kpt_items.map((item) => (
              <View key={`${item.type}-${item.label}`} style={styles.kptRow}>
                <View
                  style={[
                    styles.kptPill,
                    item.type === "keep" && styles.kptKeep,
                    item.type === "problem" && styles.kptProblem,
                    item.type === "try" && styles.kptTry,
                  ]}
                >
                  <AppText
                    style={[
                      styles.kptPillText,
                      item.type === "try" && styles.kptPillTextDark,
                    ]}
                  >
                    {item.type === "keep" ? "✅" : item.type === "problem" ? "⚠️" : "🔄"}
                  </AppText>
                </View>
                <AppText style={styles.kptLabel}>{item.label}</AppText>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, styles.cardMargin, styles.cardMuted]}>
          <AppText style={styles.cardTitle}>오늘 하루 돌아보기</AppText>
          <AppText style={styles.aiBody}>{data.ai_comment}</AppText>
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
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  backWrap: {
    width: 100,
  },
  backText: {
    fontSize: 15,
    color: MAIN,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    color: TITLE,
  },
  dateLine: {
    textAlign: "center",
    fontSize: 14,
    color: "#666666",
    marginBottom: 12,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  cardHighlight: {
    backgroundColor: "#E6F1FB",
  },
  cardMuted: {
    backgroundColor: "#EEEEEE",
  },
  moon: {
    fontSize: 28,
    marginBottom: 8,
  },
  aiSummary: {
    fontSize: 20,
    color: TITLE,
    lineHeight: 28,
    marginBottom: 8,
  },
  aiSub: {
    fontSize: 14,
    color: "#555555",
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 16,
    color: TITLE,
    marginBottom: 12,
  },
  chartCaption: {
    marginTop: 8,
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
  },
  kptEmpty: {
    fontSize: 14,
    color: "#666666",
  },
  kptRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  kptPill: {
    minWidth: 36,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginRight: 10,
  },
  kptKeep: {
    backgroundColor: "#2E7FC1",
  },
  kptProblem: {
    backgroundColor: "#E85D24",
  },
  kptTry: {
    backgroundColor: "#FFD700",
  },
  kptPillText: {
    fontSize: 12,
    color: "#FFFFFF",
  },
  kptPillTextDark: {
    color: "#1A1A2E",
  },
  kptLabel: {
    flex: 1,
    fontSize: 14,
    color: "#444444",
    lineHeight: 20,
  },
  aiBody: {
    fontSize: 15,
    color: "#444444",
    lineHeight: 24,
  },
});
