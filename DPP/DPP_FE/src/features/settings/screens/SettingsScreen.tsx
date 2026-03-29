// 설정 — TODO: 개인정보 처리방침 URL·푸시 카피·이메일 필드 백엔드 연동
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CommonActions,
  type NavigationProp,
  type ParamListBase,
} from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { getUserSummary } from "../../../services/api/main.api";
import { deleteUserData } from "../../../services/api/settings.api";
import { useAuthStore } from "../../../store/auth.store";

type Props = NativeStackScreenProps<MainStackParamList, "Settings">;

/** TODO: 실제 개인정보 처리방침 URL로 교체 */
const PRIVACY_POLICY_URL = "https://example.com/privacy";

function resetRootToOnboarding(navigation: NavigationProp<ParamListBase>): void {
  const parent = navigation.getParent();
  parent?.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Onboarding" }],
    }),
  );
}

export function SettingsScreen({ navigation }: Props) {
  const logout = useAuthStore((s) => s.logout);
  const [nickname, setNickname] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getUserSummary();
        if (alive) setNickname(s.nickname);
      } catch {
        // TODO: GET usersMeSummary 실패 시 재시도·오프라인 문구
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onLogout = useCallback(() => {
    Alert.alert("로그아웃할까요?", undefined, [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await logout();
          resetRootToOnboarding(navigation);
        },
      },
    ]);
  }, [logout, navigation]);

  const onClearData = useCallback(() => {
    Alert.alert(
      "정말 초기화할까요?",
      "모든 데이터가 삭제돼요",
      [
        { text: "취소", style: "cancel" },
        {
          text: "초기화",
          style: "destructive",
          onPress: async () => {
            try {
              // TODO: DELETE deleteUserData — 백엔드 성공 코드·에러 메시지 처리
              await deleteUserData();
            } catch {
              Alert.alert(
                "초기화에 실패했어요",
                "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
              );
              return;
            }
            await logout();
            resetRootToOnboarding(navigation);
          },
        },
      ],
    );
  }, [logout, navigation]);

  const openPrivacy = useCallback(() => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  }, []);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.topTitle}>설정</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>초기 설정</Text>
        <View style={styles.card}>
          <SettingsRow
            title="주요 목표 다시 설정하기"
            onPress={() => navigation.navigate("SettingsEditGoals", {})}
          />
          <SettingsRow
            title="심야 시간 다시 설정하기"
            onPress={() => navigation.navigate("SettingsEditNightTime", {})}
          />
          <SettingsRow
            title="주요 활동 시간 설정하기"
            onPress={() => navigation.navigate("SettingsEditActiveTime", {})}
          />
          <SettingsRow
            title="앱 카테고리 시간 설정하기"
            onPress={() => navigation.navigate("SettingsEditCategories", {})}
            isLast
          />
        </View>

        <Text style={styles.sectionHeader}>개인정보</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.rowMulti}
            onPress={openSystemSettings}
            accessibilityRole="button"
          >
            <View style={styles.rowMultiText}>
              <Text style={styles.rowTitle}>푸시 알림 설정</Text>
              <Text style={styles.rowHint}>
                앱 이용에 따른 시간 알림 제공해요
              </Text>
              <Text style={styles.rowHint}>
                알림 내용은 마케팅 목적으로 사용되지 않아요
              </Text>
              <Text style={styles.rowHint}>
                앱이 제공하는 알림 내용은 기기에 저장되어 있어요
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <SettingsRow
            title="개인정보 처리방침"
            onPress={openPrivacy}
            isLast
          />
        </View>

        <Text style={styles.sectionHeader}>계정</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.avatar} />
            <View style={styles.accountTextCol}>
              <Text style={styles.nickname}>
                {nickname.length > 0 ? nickname : "닉네임"}
              </Text>
              <Text style={styles.emailMuted}>
                {/* TODO: usersMeSummary에 이메일 필드 추가 시 표시 */}
                이메일 준비 중
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Pressable
            style={[styles.row, styles.rowLast]}
            onPress={onLogout}
            accessibilityRole="button"
          >
            <Text style={styles.rowTitle}>로그아웃</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>어떤</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.rowMulti}
            onPress={() => navigation.navigate("Achievements")}
            accessibilityRole="button"
          >
            <View style={styles.rowMultiText}>
              <Text style={styles.rowTitle}>지금까지의 여정을 한눈에 보기</Text>
              <Text style={styles.rowSub}>
                내가 해엄쳐온 바다의 흔적들
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>순서대로</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.rowMulti}
            onPress={onClearData}
            accessibilityRole="button"
          >
            <View style={styles.rowMultiText}>
              <Text style={[styles.rowTitle, styles.dangerText]}>
                앱 데이터 초기화
              </Text>
              <Text style={styles.rowSub}>
                처음부터 다시 시작할 수 있어요
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow(props: {
  title: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const { title, onPress, isLast } = props;
  return (
    <Pressable
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#F5F7FA",
  },
  back: {
    fontSize: 24,
    color: "#333333",
    minWidth: 36,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
  },
  topSpacer: {
    width: 36,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888888",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    color: "#111111",
    fontWeight: "500",
    flex: 1,
    paddingRight: 8,
  },
  chevron: {
    fontSize: 22,
    color: "#BBBBBB",
    fontWeight: "300",
  },
  rowMulti: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
  },
  rowMultiText: {
    flex: 1,
    paddingRight: 8,
  },
  rowHint: {
    fontSize: 12,
    color: "#888888",
    marginTop: 4,
    lineHeight: 17,
  },
  rowSub: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEEEEE",
    marginLeft: 16,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D0D8E0",
    marginRight: 12,
  },
  accountTextCol: {
    flex: 1,
  },
  nickname: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },
  emailMuted: {
    fontSize: 12,
    color: "#888888",
    marginTop: 4,
  },
  dangerText: {
    color: "#D32F2F",
    fontWeight: "600",
  },
});
