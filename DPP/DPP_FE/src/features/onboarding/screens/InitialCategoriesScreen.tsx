// 설치 앱 카테고리 확인·조정
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type {
  MainStackParamList,
  OnboardingFocusCategoryItem,
  OnboardingStackParamList,
} from "../../../navigation/types";
import { type InstalledApp } from "../../../services/api/dashboard.api";
import { useAuthStore } from "../../../store/auth.store";
import { OnboardingStepLayout } from "../components/OnboardingStepLayout";

type Props =
  | NativeStackScreenProps<OnboardingStackParamList, "InitialCategories">
  | NativeStackScreenProps<MainStackParamList, "SettingsEditCategories">;

type UsageStatsNativeApp = {
  packageName: string;
  appName: string;
  categoryId: number;
  categoryName?: string;
  iconBase64?: string;
};

type UsageStatsExtended = {
  getInstalledAppsWithCategory?: () => Promise<UsageStatsNativeApp[]>;
  getInstalledApps?: () => Promise<{ packageName: string; appName: string }[]>;
};

type Group = {
  id: number;
  name: string;
  apps: InstalledApp[];
};

const BG = "#F5F7FA";
const MAIN = "#2E7FC1";
const SKIP = "#6C7A89";

const CATEGORY_MAP: Record<number, string> = {
  0: "게임",
  1: "오디오",
  2: "비디오",
  3: "이미지",
  4: "소셜",
  5: "뉴스",
  6: "지도",
  7: "생산성",
  8: "시스템",
  9: "쇼핑 및 음식",
  10: "정보 및 도서",
  11: "금융",
  12: "이동성",
  13: "교육",
  14: "건강",
  [-1]: "미분류",
};

const CATEGORY_THEME: Record<number, { cardBg: string; accent: string }> = {
  0: { cardBg: "#E7F0FF", accent: "#2E7FC1" },
  1: { cardBg: "#F3E5F5", accent: "#9C27B0" },
  2: { cardBg: "#FFE7E1", accent: "#FF5722" },
  3: { cardBg: "#E8F5E9", accent: "#4CAF50" },
  4: { cardBg: "#E0F7FA", accent: "#03A9F4" },
  5: { cardBg: "#FCE4EC", accent: "#E91E63" },
  6: { cardBg: "#EFEBE9", accent: "#795548" },
  7: { cardBg: "#FFF8E1", accent: "#FFC107" },
  8: { cardBg: "#ECEFF1", accent: "#607D8B" },
  9: { cardBg: "#E8F5E9", accent: "#8BC34A" },
  10: { cardBg: "#E3F2FD", accent: "#2196F3" },
  11: { cardBg: "#F3E5F5", accent: "#6A1B9A" },
  12: { cardBg: "#F1F8E9", accent: "#7CB342" },
  13: { cardBg: "#E8F5E9", accent: "#2E7D32" },
  14: { cardBg: "#FFF3E0", accent: "#FF9800" },
  [-1]: { cardBg: "#F0F0F0", accent: "#6C7A89" },
};

const CATEGORY_ORDER = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, -1,
] as const;

function toMappedApp(raw: UsageStatsNativeApp): InstalledApp {
  const safeId = Number.isInteger(raw.categoryId) ? raw.categoryId : -1;
  const categoryName = CATEGORY_MAP[safeId] ?? CATEGORY_MAP[-1];
  return {
    packageName: raw.packageName,
    appName: raw.appName,
    categoryId: safeId,
    categoryName,
    iconBase64: raw.iconBase64,
  };
}

function groupByCategory(apps: InstalledApp[]): Group[] {
  const grouped = new Map<number, InstalledApp[]>();
  for (const app of apps) {
    const list = grouped.get(app.categoryId) ?? [];
    list.push(app);
    grouped.set(app.categoryId, list);
  }
  const groups: Group[] = [];
  for (const [id, list] of grouped.entries()) {
    groups.push({
      id,
      name: CATEGORY_MAP[id] ?? CATEGORY_MAP[-1],
      apps: [...list].sort((a, b) => a.appName.localeCompare(b.appName)),
    });
  }
  const indexMap = new Map<number, number>(
    CATEGORY_ORDER.map((id, idx) => [id, idx]),
  );
  groups.sort((a, b) => (indexMap.get(a.id) ?? 999) - (indexMap.get(b.id) ?? 999));
  return groups;
}

function toFocusPayload(groups: Group[]): OnboardingFocusCategoryItem[] {
  return groups.map((g) => ({
    id: String(g.id),
    name: g.name,
    app_count: g.apps.length,
  }));
}

export function InitialCategoriesScreen({ navigation, route }: Props) {
  const isEdit = route.params?.isEditMode === true;
  const setOnboardingData = useAuthStore((s) => s.setOnboardingData);

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tabId, setTabId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<InstalledApp | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { UsageStatsModule } = NativeModules as {
          UsageStatsModule?: UsageStatsExtended;
        };

        const hasModule = UsageStatsModule != null;
        const hasFn = typeof UsageStatsModule?.getInstalledAppsWithCategory === "function";
        console.log("[InitialCategoriesScreen] hasModule:", hasModule);
        console.log(
          "[InitialCategoriesScreen] has getInstalledAppsWithCategory:",
          hasFn,
        );

        const raw = UsageStatsModule?.getInstalledAppsWithCategory
          ? await UsageStatsModule.getInstalledAppsWithCategory()
          : [];
        if (!alive) return;

        const safe = Array.isArray(raw) ? raw : [];
        console.log(
          "[InitialCategoriesScreen] getInstalledAppsWithCategory length:",
          safe.length,
        );

        if (safe.length === 0 && UsageStatsModule?.getInstalledApps) {
          console.warn(
            "[InitialCategoriesScreen] withCategory returned empty; using getInstalledApps() fallback",
          );
          const fallbackRaw = await UsageStatsModule.getInstalledApps();
          const fallback = Array.isArray(fallbackRaw) ? fallbackRaw : [];
          console.log(
            "[InitialCategoriesScreen] getInstalledApps() fallback length:",
            fallback.length,
          );
          const mappedFallback: InstalledApp[] = fallback.map((a) => ({
            packageName: a.packageName,
            appName: a.appName,
            categoryId: -1,
            categoryName: CATEGORY_MAP[-1],
          }));
          setApps(mappedFallback);
          const groupedFallback = groupByCategory(mappedFallback);
          setGroups(groupedFallback);
          setTabId(groupedFallback[0]?.id ?? -1);
          return;
        }

        const mapped = safe.map(toMappedApp);
        const grouped = groupByCategory(mapped);
        setApps(mapped);
        setGroups(grouped);
        setTabId(grouped[0]?.id ?? -1);
      } catch (e: unknown) {
        console.error(e);
        setApps([]);
        setGroups([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentApps = useMemo(() => {
    const g = groups.find((x) => x.id === tabId);
    return g?.apps ?? [];
  }, [groups, tabId]);

  const moveAppToCategory = useCallback((pkg: string, nextCategoryId: number) => {
    setApps((prev) => {
      const next = prev.map((a) =>
        a.packageName === pkg
          ? {
              ...a,
              categoryId: nextCategoryId,
              categoryName: CATEGORY_MAP[nextCategoryId] ?? CATEGORY_MAP[-1],
            }
          : a,
      );
      const grouped = groupByCategory(next);
      setGroups(grouped);
      return next;
    });
    setMoveTarget(null);
  }, []);

  const navigateNext = useCallback(() => {
    (
      navigation as NativeStackNavigationProp<OnboardingStackParamList>
    ).navigate("InitialFocusCategory", {
      categories: toFocusPayload(groups),
    });
  }, [groups, navigation]);

  const onConfirm = useCallback(async () => {
    setSaving(true);
    await setOnboardingData({ categories: apps });
    // TODO: 로그 전송 시 카테고리 정보 활용
    navigateNext();
    setSaving(false);
  }, [apps, navigateNext, setOnboardingData]);

  const onSkip = useCallback(() => {
    navigateNext();
  }, [navigateNext]);

  const activeCategoryId = tabId ?? -1;
  const activeTheme = CATEGORY_THEME[activeCategoryId] ?? CATEGORY_THEME[-1];
  const activeCategoryName =
    CATEGORY_MAP[activeCategoryId] ?? CATEGORY_MAP[-1];

  return (
    <OnboardingStepLayout
      step={5}
      hideProgress={isEdit}
      title="카테고리를 확인해주세요"
      subtitle="앱을 분석해 자동으로 분류했어요. 앱을 길게 눌러 카테고리를 이동할 수 있어요"
      onBack={() => navigation.goBack()}
      headerRight={
        !isEdit ? (
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        ) : undefined
      }
      footer={
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (loading || saving) && styles.primaryBtnDisabled,
            pressed && !loading && !saving && styles.primaryBtnPressed,
          ]}
          onPress={() => void onConfirm()}
          disabled={loading || saving}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? "저장하기" : "확인하기"}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {isEdit ? "저장하기" : "확인하기"}
            </Text>
          )}
        </Pressable>
      }
    >
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={MAIN} />
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {groups.map((g) => {
                const on = g.id === tabId;
              const tabTheme = CATEGORY_THEME[g.id] ?? CATEGORY_THEME[-1];
                return (
                  <Pressable
                    key={g.id}
                  style={[
                    styles.tab,
                    on
                      ? { backgroundColor: tabTheme.accent, shadowColor: tabTheme.accent }
                      : null,
                  ]}
                    onPress={() => setTabId(g.id)}
                  >
                  <Text
                    style={[
                      styles.tabText,
                      on ? { color: "#FFFFFF" } : null,
                    ]}
                  >
                    {g.name}
                  </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View
              style={[
                styles.categoryCard,
                { backgroundColor: activeTheme.cardBg, borderColor: activeTheme.accent },
              ]}
            >
              <View style={styles.categoryCardHeader}>
                <Text
                  style={[
                    styles.categoryCardTitle,
                    { color: activeTheme.accent },
                  ]}
                >
                  {activeCategoryName}
                </Text>
                <Text style={styles.categoryCardCount}>
                  {currentApps.length}개
                </Text>
              </View>

              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {currentApps.map((app) => (
                  <Pressable
                    key={app.packageName}
                    style={[
                      styles.appRow,
                      { borderLeftColor: activeTheme.accent },
                    ]}
                    onLongPress={() => setMoveTarget(app)}
                    accessibilityRole="button"
                    accessibilityLabel={`${app.appName} 길게 눌러 이동`}
                  >
                    <View
                      style={[
                        styles.appIconBox,
                        { borderColor: activeTheme.accent },
                      ]}
                    >
                      {app.iconBase64 ? (
                        <Image
                          source={{
                            uri: `data:image/png;base64,${app.iconBase64}`,
                          }}
                          style={styles.appIcon}
                        />
                      ) : (
                        <Text style={styles.appIconFallback}>앱</Text>
                      )}
                    </View>

                    <View style={styles.appTextCol}>
                      <Text style={styles.appName}>{app.appName}</Text>
                      <Text style={styles.appPkg}>{app.packageName}</Text>
                    </View>
                  </Pressable>
                ))}
                {currentApps.length === 0 ? (
                  <Text style={styles.empty}>이 카테고리에 앱이 없어요</Text>
                ) : null}
              </ScrollView>
            </View>
          </>
        )}
      </View>

      <Modal
        visible={moveTarget != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>카테고리 이동</Text>
            <Text style={styles.sheetSub} numberOfLines={1}>
              {moveTarget?.appName}
            </Text>
            <ScrollView style={styles.sheetList}>
              {CATEGORY_ORDER.map((id) => (
                (() => {
                  const theme = CATEGORY_THEME[id] ?? CATEGORY_THEME[-1];
                  return (
                <Pressable
                  key={id}
                  style={[
                    styles.sheetRow,
                    { borderLeftColor: theme.accent },
                  ]}
                  onPress={() => {
                    if (moveTarget) {
                      moveAppToCategory(moveTarget.packageName, id);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.sheetRowDot,
                      { backgroundColor: theme.accent },
                    ]}
                  />
                  <Text
                    style={[
                      styles.sheetRowText,
                      { color: theme.accent },
                    ]}
                  >
                    {CATEGORY_MAP[id]}
                  </Text>
                </Pressable>
                  );
                })()
              ))}
            </ScrollView>
            <Pressable
              style={styles.sheetCancel}
              onPress={() => setMoveTarget(null)}
            >
              <Text style={styles.sheetCancelText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
    backgroundColor: BG,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    borderRadius: 18,
    backgroundColor: "#E7ECF2",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tabOn: {
    backgroundColor: MAIN,
  },
  tabText: {
    color: "#2F3A45",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextOn: {
    color: "#FFFFFF",
  },
  categoryCard: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },

  categoryCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  categoryCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111111",
  },

  categoryCardCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2F3A45",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  list: {
    flex: 1,
    backgroundColor: "transparent",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 4,
    borderLeftColor: MAIN,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  appIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 12,
  },
  appIcon: {
    width: 36,
    height: 36,
  },
  appIconFallback: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6C7A89",
  },
  appTextCol: {
    flex: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  appPkg: {
    marginTop: 2,
    fontSize: 12,
    color: "#7A8695",
  },
  empty: {
    textAlign: "center",
    color: "#8793A1",
    marginTop: 28,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: "70%",
  },
  sheetTitle: {
    marginTop: 16,
    marginBottom: 4,
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },
  sheetSub: {
    marginBottom: 12,
    fontSize: 14,
    color: "#666666",
  },
  sheetList: {
    maxHeight: 280,
  },
  sheetRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
  },
  sheetRowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 10,
  },
  sheetRowText: {
    fontSize: 16,
    color: "#111111",
  },
  sheetCancel: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  sheetCancelText: {
    color: MAIN,
    fontSize: 16,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: MAIN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnPressed: {
    opacity: 0.92,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  skipText: {
    color: SKIP,
    fontSize: 14,
    fontWeight: "600",
  },
});
