import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
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
  const d = parseDateKey(dateKey);
  const dow = WEEKDAYS_KO[d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${dow}요일`;
}

function buildMockDaily(dateKey: string): DailyReportData {
  return {
    date: dateKey,
    ai_summary: "밤 시간 사용이 조금 길었던 날이에요",
    time_buckets: [
      { hour: 9, minutes: 20 },
      { hour: 10, minutes: 35 },
      { hour: 12, minutes: 15 },
      { hour: 14, minutes: 40 },
      { hour: 18, minutes: 25 },
      { hour: 20, minutes: 55 },
      { hour: 22, minutes: 70 },
      { hour: 23, minutes: 45 },
    ],
    category_usage: [
      { name: "소셜", minutes: 85, color: "#2E7FC1" },
      { name: "동영상", minutes: 62, color: "#FF6B9D" },
      { name: "생산성", minutes: 43, color: "#FFB347" },
      { name: "게임", minutes: 28, color: "#98FB98" },
    ],
    kpt_items: [
      { type: "keep", label: "저녁·늦은 밤에 몰린 날" },
      { type: "problem", label: "잦은 확인함" },
    ],
    ai_comment:
      "오늘은 소셜과 동영상 사이를 오가며 시간을 보내셨네요. 저녁 시간대에 집중이 높아졌다가, 밤이 되면서 자연스럽게 줄어드는 흐름이 보여요.\n\n내일도 이런 잔잔한 리듬으로 헤엄쳐보면 어떨까요?",
  };
}

const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 40;

type TimeFlowChartProps = {
  buckets: { hour: number; minutes: number }[];
  width: number;
  height: number;
};

function TimeFlowChart({ buckets, width, height }: TimeFlowChartProps) {
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;
  const maxM = Math.max(
    1,
    ...buckets.map((b) => b.minutes),
  );
  const sorted = [...buckets].sort((a, b) => a.hour - b.hour);

  const hourToX = (h: number) => PAD_L + (h / 24) * innerW;
  const band = (h0: number, h1: number, fill: string) => {
    const x = hourToX(h0);
    const w = ((h1 - h0) / 24) * innerW;
    return (
      <Rect
        key={`${h0}-${h1}-${fill}`}
        x={x}
        y={PAD_T}
        width={w}
        height={innerH}
        fill={fill}
        opacity={0.45}
      />
    );
  };

  const points = sorted
    .map((b) => {
      const cx = hourToX(b.hour + 0.5);
      const cy = PAD_T + innerH - (b.minutes / maxM) * innerH;
      return `${cx},${cy}`;
    })
    .join(" ");

  const baselineY = PAD_T + innerH;

  return (
    <Svg width={width} height={height}>
      {band(0, 6, "#E8E8F0")}
      {band(6, 12, "#FFF8E7")}
      {band(12, 18, "#E8F4FC")}
      {band(18, 22, "#FFE8DC")}
      {band(22, 24, "#E8E8F0")}
      <Line
        x1={PAD_L}
        y1={baselineY}
        x2={PAD_L + innerW}
        y2={baselineY}
        stroke="#CCCCCC"
        strokeWidth={1}
      />
      {points.length > 0 ? (
        <Polyline
          points={points}
          fill="none"
          stroke={MAIN}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {[0, 6, 12, 18, 23].map((h) => (
        <SvgText
          key={`lx-${h}`}
          x={hourToX(h)}
          y={height - 8}
          fill="#888888"
          fontSize={10}
          textAnchor="middle"
        >
          {`${h}시`}
        </SvgText>
      ))}
    </Svg>
  );
}

export function DailyReportScreen({ navigation, route }: Props) {
  const [data, setData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const chartW = Dimensions.get("window").width - 32 * 2;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // TODO: GET /reports/daily?date= → getDailyReportByDate(route.params.date)
        await new Promise<void>((r) => setTimeout(r, 280));
        if (alive) setData(buildMockDaily(route.params.date));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [route.params.date]);

  const maxCat = useMemo(() => {
    if (!data?.category_usage.length) return 1;
    return Math.max(...data.category_usage.map((c) => c.minutes), 1);
  }, [data]);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={MAIN} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backWrap}
        >
          <Text style={styles.backText}>← 목록으로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>하루의 기록</Text>
        <View style={styles.backWrap} />
      </View>
      <Text style={styles.dateLine}>{formatKoreanLongDate(data.date)}</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.cardHighlight]}>
          <Text style={styles.moon}>🌙</Text>
          <Text style={styles.aiSummary}>{data.ai_summary}</Text>
          <Text style={styles.aiSub}>
            내일도 조금 편히 헤엄칠 준비를 해볼까요?
          </Text>
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <Text style={styles.cardTitle}>시간의 흐름</Text>
          <View style={styles.legendRow}>
            <LegendDot color="#FFF8E7" label="아침" border />
            <LegendDot color="#E8F4FC" label="낮" border />
            <LegendDot color="#FFE8DC" label="저녁" border />
            <LegendDot color="#E8E8F0" label="밤" border />
          </View>
          <TimeFlowChart
            buckets={data.time_buckets}
            width={chartW}
            height={200}
          />
          <Text style={styles.chartCaption}>하루 동안의 기기 사용 흐름</Text>
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <Text style={styles.cardTitle}>주로 어떤 물결과 함께했나요</Text>
          {data.category_usage.map((c) => (
            <View key={c.name} style={styles.catBlock}>
              <View style={styles.catRow}>
                <View
                  style={[styles.catIconDot, { backgroundColor: c.color }]}
                />
                <View style={styles.catMeta}>
                  <Text style={styles.catName}>{c.name}</Text>
                  <Text style={styles.catMin}>{c.minutes}분</Text>
                </View>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round((c.minutes / maxCat) * 100)}%`,
                      backgroundColor: c.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.cardMargin]}>
          <Text style={styles.cardTitle}>오늘의 다짐</Text>
          {data.kpt_items.length === 0 ? (
            <Text style={styles.kptEmpty}>오늘은 체크인을 패스했어요</Text>
          ) : (
            data.kpt_items.map((item) => (
              <View key={item.label} style={styles.kptRow}>
                <View
                  style={[
                    styles.kptPill,
                    item.type === "keep" && styles.kptKeep,
                    item.type === "problem" && styles.kptProblem,
                    item.type === "try" && styles.kptTry,
                  ]}
                >
                  <Text
                    style={[
                      styles.kptPillText,
                      item.type === "try" && styles.kptPillTextDark,
                    ]}
                  >
                    {item.type === "keep"
                      ? "✅"
                      : item.type === "problem"
                        ? "⚠️"
                        : "🔄"}
                  </Text>
                </View>
                <Text style={styles.kptLabel}>{item.label}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, styles.cardMargin, styles.cardMuted]}>
          <Text style={styles.cardTitle}>오늘 하루 돌아보기</Text>
          <Text style={styles.aiBody}>{data.ai_comment}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendDot({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color },
          border && styles.legendSwatchBorder,
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
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
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
    color: TITLE,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendSwatchBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#CCCCCC",
  },
  legendLabel: {
    fontSize: 11,
    color: "#666666",
  },
  chartCaption: {
    marginTop: 8,
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
  },
  catBlock: {
    marginBottom: 12,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  catIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  catMeta: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catName: {
    fontSize: 15,
    fontWeight: "600",
    color: TITLE,
  },
  catMin: {
    fontSize: 14,
    color: "#666666",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8ECEF",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
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
    fontWeight: "700",
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
