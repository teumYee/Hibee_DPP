import { AppText } from "../../../components/AppText";
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { APP_FONT_FAMILY } from "../../../theme/typography";
import type { ReportMetric, ReportTrendPoint, ReportUsageItem } from "../types";

const MAIN = "#2E7FC1";
const TITLE = "#1A1A2E";

const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 40;

export function TimeFlowChart({
  buckets,
  width,
  height,
}: {
  buckets: { hour: number; minutes: number }[];
  width: number;
  height: number;
}) {
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;
  const maxM = Math.max(1, ...buckets.map((b) => b.minutes));
  const sorted = [...buckets].sort((a, b) => a.hour - b.hour);

  const hourToX = (hour: number) => PAD_L + (hour / 24) * innerW;
  const points = sorted
    .map((bucket) => {
      const cx = hourToX(bucket.hour + 0.5);
      const cy = PAD_T + innerH - (bucket.minutes / maxM) * innerH;
      return `${cx},${cy}`;
    })
    .join(" ");
  const baselineY = PAD_T + innerH;

  const renderBand = (startHour: number, endHour: number, fill: string) => {
    const x = hourToX(startHour);
    const bandWidth = ((endHour - startHour) / 24) * innerW;
    return (
      <Rect
        key={`${startHour}-${endHour}-${fill}`}
        x={x}
        y={PAD_T}
        width={bandWidth}
        height={innerH}
        fill={fill}
        opacity={0.45}
      />
    );
  };

  return (
    <Svg width={width} height={height}>
      {renderBand(0, 6, "#E8E8F0")}
      {renderBand(6, 12, "#FFF8E7")}
      {renderBand(12, 18, "#E8F4FC")}
      {renderBand(18, 22, "#FFE8DC")}
      {renderBand(22, 24, "#E8E8F0")}
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
      {[0, 6, 12, 18, 23].map((hour) => (
        <SvgText
          key={`time-${hour}`}
          x={hourToX(hour)}
          y={height - 8}
          fill="#888888"
          fontFamily={APP_FONT_FAMILY}
          fontSize={10}
          textAnchor="middle"
        >
          {`${hour}시`}
        </SvgText>
      ))}
    </Svg>
  );
}

export function MetricGrid({ items }: { items: ReportMetric[] }) {
  return (
    <View style={styles.metricGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.metricCard}>
          <AppText style={styles.metricLabel}>{item.label}</AppText>
          <AppText style={styles.metricValue}>
            {item.value}
            {item.unit ? item.unit : ""}
          </AppText>
          {item.helper ? <AppText style={styles.metricHelper}>{item.helper}</AppText> : null}
        </View>
      ))}
    </View>
  );
}

export function HorizontalBarList({
  items,
  emptyText,
  valueSuffix = "분",
}: {
  items: Array<{ key: string; title: string; amount: number; color: string; meta?: string }>;
  emptyText: string;
  valueSuffix?: string;
}) {
  const maxAmount = Math.max(1, ...items.map((item) => item.amount));

  if (items.length === 0) {
    return <AppText style={styles.emptyText}>{emptyText}</AppText>;
  }

  return (
    <View>
      {items.map((item) => (
        <View key={item.key} style={styles.barBlock}>
          <View style={styles.barHeader}>
            <View style={styles.barTitleRow}>
              <View style={[styles.barDot, { backgroundColor: item.color }]} />
              <AppText style={styles.barTitle}>{item.title}</AppText>
            </View>
            <AppText style={styles.barAmount}>
              {item.amount}
              {valueSuffix}
            </AppText>
          </View>
          {item.meta ? <AppText style={styles.barMeta}>{item.meta}</AppText> : null}
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(8, Math.round((item.amount / maxAmount) * 100))}%`,
                  backgroundColor: item.color,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TimelineBarChart({ items }: { items: ReportUsageItem[] }) {
  const maxMinutes = Math.max(1, ...items.map((item) => item.minutes));

  return (
    <View style={styles.timelineWrap}>
      {items.map((item) => (
        <View key={item.name} style={styles.timelineItem}>
          <View style={styles.timelineTrack}>
            <View
              style={[
                styles.timelineFill,
                {
                  height: `${Math.max(8, Math.round((item.minutes / maxMinutes) * 100))}%`,
                  backgroundColor: item.color,
                },
              ]}
            />
          </View>
          <AppText style={styles.timelineValue}>{item.minutes}분</AppText>
          <AppText style={styles.timelineLabel}>{item.name}</AppText>
        </View>
      ))}
    </View>
  );
}

export function UsageTrendChart({ points }: { points: ReportTrendPoint[] }) {
  const maxMinutes = Math.max(1, ...points.map((point) => point.minutes));

  return (
    <View style={styles.timelineWrap}>
      {points.map((point) => (
        <View key={point.key} style={styles.timelineItem}>
          <View style={styles.timelineTrack}>
            <View
              style={[
                styles.timelineFill,
                {
                  height: `${Math.max(8, Math.round((point.minutes / maxMinutes) * 100))}%`,
                  backgroundColor: MAIN,
                },
              ]}
            />
          </View>
          <AppText style={styles.timelineValue}>{point.minutes}분</AppText>
          <AppText style={styles.timelineLabel}>{point.label}</AppText>
        </View>
      ))}
    </View>
  );
}

export function DonutCategoryChart({ items }: { items: ReportUsageItem[] }) {
  const total = items.reduce((sum, item) => sum + item.minutes, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (items.length === 0 || total <= 0) {
    return <AppText style={styles.emptyText}>카테고리 데이터가 없어요.</AppText>;
  }

  return (
    <View style={styles.donutSection}>
      <Svg width={120} height={120}>
        <Circle
          cx={60}
          cy={60}
          r={radius}
          stroke="#E8ECEF"
          strokeWidth={16}
          fill="none"
        />
        {items.map((item) => {
          const segment = (item.minutes / total) * circumference;
          const circle = (
            <Circle
              key={item.name}
              cx={60}
              cy={60}
              r={radius}
              stroke={item.color}
              strokeWidth={16}
              fill="none"
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={-offset}
              rotation={-90}
              origin="60, 60"
            />
          );
          offset += segment;
          return circle;
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <AppText style={styles.donutTotalLabel}>총합</AppText>
        <AppText style={styles.donutTotalValue}>{total}분</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    borderRadius: 14,
    backgroundColor: "#F7FAFD",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5EDF5",
  },
  metricLabel: {
    fontSize: 13,
    color: "#6A7A88",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    color: TITLE,
  },
  metricHelper: {
    marginTop: 6,
    fontSize: 12,
    color: "#8A98A8",
  },
  barBlock: {
    marginBottom: 14,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  barTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  barDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  barTitle: {
    flex: 1,
    fontSize: 14,
    color: TITLE,
  },
  barAmount: {
    fontSize: 13,
    color: "#5A6B7B",
  },
  barMeta: {
    fontSize: 12,
    color: "#7B8A97",
    marginBottom: 6,
    marginLeft: 18,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8ECEF",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  timelineWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 170,
  },
  timelineItem: {
    flex: 1,
    alignItems: "center",
  },
  timelineTrack: {
    width: "100%",
    height: 92,
    borderRadius: 10,
    justifyContent: "flex-end",
    backgroundColor: "#EEF3F8",
    padding: 6,
  },
  timelineFill: {
    width: "100%",
    borderRadius: 8,
    minHeight: 8,
  },
  timelineValue: {
    marginTop: 8,
    fontSize: 11,
    color: "#607080",
    textAlign: "center",
  },
  timelineLabel: {
    marginTop: 4,
    fontSize: 11,
    color: "#607080",
    textAlign: "center",
  },
  donutSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
  },
  donutTotalLabel: {
    fontSize: 12,
    color: "#7B8A97",
  },
  donutTotalValue: {
    fontSize: 18,
    color: TITLE,
  },
  emptyText: {
    fontSize: 14,
    color: "#7B8A97",
  },
});
