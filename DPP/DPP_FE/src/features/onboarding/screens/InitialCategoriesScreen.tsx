// 설치 앱 카테고리 확인·조정
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { OnboardingStepLayout } from "../components/OnboardingStepLayout";
import {
  postAppsInstalled,
  putUserCategories,
  type CategorizedAppItem,
  type ServerCategoryGroup,
} from "../../../services/api/dashboard.api";

type Props =
  | NativeStackScreenProps<OnboardingStackParamList, "InitialCategories">
  | NativeStackScreenProps<MainStackParamList, "SettingsEditCategories">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";
const SKIP = "#6C7A89";

type UsageStatsExtended = {
  getInstalledApps?: () => Promise<
    { packageName: string; appName: string }[]
  >;
};

function cloneGroups(groups: ServerCategoryGroup[]): ServerCategoryGroup[] {
  return groups.map((g) => ({
    ...g,
    apps: g.apps.map((a) => ({ ...a })),
  }));
}

export function InitialCategoriesScreen({ navigation, route }: Props) {
  const isEdit = route.params?.isEditMode === true;
  const [groups, setGroups] = useState<ServerCategoryGroup[]>([]);
  const [tabId, setTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<CategorizedAppItem | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { UsageStatsModule } = NativeModules as {
          UsageStatsModule?: UsageStatsExtended;
        };
        let appsPayload: { package_name: string; app_name: string }[] = [];
        if (UsageStatsModule?.getInstalledApps) {
          const raw = await UsageStatsModule.getInstalledApps();
          appsPayload = raw.map((r) => ({
            package_name: r.packageName,
            app_name: r.appName,
          }));
        }
        const res = await postAppsInstalled({ apps: appsPayload });
        if (!alive) return;
        const next = cloneGroups(res.categories).map((g) => ({
          ...g,
          apps: g.apps.map((a, idx) => ({
            ...a,
            id: a.id ?? `${g.id}_${a.package_name}_${idx}`,
          })),
        }));
        setGroups(next);
        setTabId(next[0]?.id ?? null);
      } catch (e: unknown) {
        console.error(e);
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

  const moveAppToCategory = useCallback(
    (pkg: string, categoryId: string) => {
      setGroups((prev) => {
        const next = cloneGroups(prev);
        let moved: CategorizedAppItem | null = null;
        for (const g of next) {
          const idx = g.apps.findIndex((a) => a.package_name === pkg);
          if (idx >= 0) {
            const [item] = g.apps.splice(idx, 1);
            moved = item;
            break;
          }
        }
        if (moved) {
          const target = next.find((g) => g.id === categoryId);
          if (target) target.apps.push(moved);
        }
        return next;
      });
      setMoveTarget(null);
    },
    [],
  );

  const onConfirm = useCallback(async () => {
    setSaving(true);
    try {
      const assignments = groups.flatMap((g) =>
        g.apps.map((a) => ({
          category_id: g.id,
          package_name: a.package_name,
        })),
      );
      await putUserCategories({ assignments });
      const focusPayload: OnboardingFocusCategoryItem[] = groups.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        app_count: g.apps.length,
      }));
      (
        navigation as NativeStackNavigationProp<OnboardingStackParamList>
      ).navigate("InitialFocusCategory", {
        categories: focusPayload,
      });
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [groups, navigation]);

  const onSkip = useCallback(() => {
    // TODO: 테스트용 - BE 완성 후 제거
    const focusPayload: OnboardingFocusCategoryItem[] = groups.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      app_count: g.apps.length,
    }));
    (
      navigation as NativeStackNavigationProp<OnboardingStackParamList>
    ).navigate("InitialFocusCategory", {
      categories: focusPayload,
    });
  }, [groups, navigation]);

  const footer = (
    <Pressable
      style={({ pressed }) => [
        styles.primaryBtn,
        (loading || saving) && styles.primaryBtnDisabled,
        pressed && !loading && !saving && styles.primaryBtnPressed,
      ]}
      onPress={onConfirm}
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
  );

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
      footer={footer}
    >
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
              return (
                <Pressable
                  key={g.id}
                  style={[styles.tab, on && styles.tabOn]}
                  onPress={() => setTabId(g.id)}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>
                    {g.icon ? `${g.icon} ` : ""}
                    {g.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {currentApps.map((app) => (
              <Pressable
                key={app.id}
                style={styles.appRow}
                onLongPress={() => setMoveTarget(app)}
                accessibilityRole="button"
                accessibilityLabel={`${app.app_name} 길게 눌러 이동`}
              >
                <View style={styles.appTextCol}>
                  <Text style={styles.appName}>{app.app_name}</Text>
                  <Text style={styles.appPkg}>{app.package_name}</Text>
                </View>
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            ))}
            {currentApps.length === 0 ? (
              <Text style={styles.empty}>이 카테고리에 앱이 없어요</Text>
            ) : null}
          </ScrollView>
        </>
      )}

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
              {moveTarget?.app_name}
            </Text>
            <ScrollView style={styles.sheetList}>
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  style={styles.sheetRow}
                  onPress={() => {
                    if (moveTarget) {
                      moveAppToCategory(moveTarget.package_name, g.id);
                    }
                  }}
                >
                  <Text style={styles.sheetRowText}>{g.name}</Text>
                </Pressable>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  tabs: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    flexDirection: "row",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  tabOn: {
    backgroundColor: MAIN,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  tabTextOn: {
    color: "#FFFFFF",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  appTextCol: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },
  appPkg: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  editIcon: {
    fontSize: 18,
    color: MAIN,
    paddingLeft: 8,
  },
  empty: {
    textAlign: "center",
    color: "#888888",
    marginTop: 24,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: "70%",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 12,
  },
  sheetList: {
    maxHeight: 280,
  },
  sheetRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
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
    fontSize: 16,
    color: MAIN,
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
