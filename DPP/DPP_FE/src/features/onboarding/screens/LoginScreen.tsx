// Google 로그인
import { AppText } from "../../../components/AppText";
import { LoadingOverlay } from "../../../components/LoadingOverlay";
import React, { useCallback, useState } from "react";
import {
  Alert,
  AppState,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
  type SignInResponse,
} from "@react-native-google-signin/google-signin";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  OnboardingStackParamList,
  RootStackParamList,
} from "../../../navigation/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuthStore } from "../../../store/auth.store";
import { ENDPOINTS } from "../../../services/api/endpoints";
import { post } from "../../../services/api/client";
import { getUserBootstrap } from "../../../services/api/main.api";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Login">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";

/** Android: React Native가 current Activity를 붙이기 전 signIn 호출 시 NULL_PRESENTER 방지 */
function waitForAndroidActivityReady(): Promise<void> {
  if (Platform.OS !== "android") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

function isNullPresenterError(e: unknown): boolean {
  return isErrorWithCode(e) && e.code === statusCodes.NULL_PRESENTER;
}

/** Bridgeless 등에서 getCurrentActivity()가 잠깐 null인 경우 재시도 */
async function signInWithGoogleAndroid(): Promise<SignInResponse> {
  const maxAttempts = 12;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (AppState.currentState !== "active") {
      await new Promise<void>((r) => {
        const sub = AppState.addEventListener("change", (state) => {
          if (state === "active") {
            sub.remove();
            r();
          }
        });
      });
    }
    await waitForAndroidActivityReady();
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, 40 * attempt));
    }
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      return await GoogleSignin.signIn();
    } catch (e) {
      lastError = e;
      if (isNullPresenterError(e) && attempt < maxAttempts - 1) {
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

type GoogleLoginResponse = {
  id: number;
  email: string;
  nickname: string;
  message: string;
  access_token?: string;
  token_type?: string;
};

export function LoginScreen({ navigation }: Props) {
  const setToken = useAuthStore((s) => s.setToken);
  const setUserId = useAuthStore((s) => s.setUserId);
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);
  const replaceOnboardingData = useAuthStore((s) => s.replaceOnboardingData);
  const [loading, setLoading] = useState(false);

  const onGooglePress = useCallback(async () => {
    setLoading(true);
    try {
      const result =
        Platform.OS === "android"
          ? await signInWithGoogleAndroid()
          : await (async () => {
              await waitForAndroidActivityReady();
              await GoogleSignin.hasPlayServices({
                showPlayServicesUpdateDialog: true,
              });
              return GoogleSignin.signIn();
            })();
      if (result.type === "cancelled") {
        return;
      }
      const idToken = result.data.idToken;
      if (!idToken) {
        Alert.alert("로그인 실패", "Google 토큰을 가져오지 못했어요.");
        return;
      }
      const loginResult = await post<GoogleLoginResponse>(
        ENDPOINTS.authGoogleLogin,
        { idToken: idToken },
      );
      await setToken(loginResult.access_token ?? idToken);
      await setUserId(loginResult.id);
      const bootstrap = await getUserBootstrap();
      await setOnboardingDone(bootstrap.onboarding_completed);
      await replaceOnboardingData({
        goals: bootstrap.onboarding_data.goals,
        active_time: bootstrap.onboarding_data.active_times[0] ?? "",
        night_mode_start: bootstrap.onboarding_data.night_mode_start,
        night_mode_end: bootstrap.onboarding_data.night_mode_end,
        checkin_time: bootstrap.onboarding_data.checkin_time,
        checkin_window_minutes: bootstrap.onboarding_data.checkin_window_minutes,
        day_rollover_time: bootstrap.onboarding_data.day_rollover_time,
        struggles: bootstrap.onboarding_data.struggles,
        focus_categories: bootstrap.onboarding_data.focus_categories,
        categories: useAuthStore.getState().onboardingData.categories,
      });
      if (bootstrap.onboarding_completed) {
        const parent = navigation.getParent<
          NativeStackNavigationProp<RootStackParamList>
        >();
        parent?.navigate("Main", { screen: "Home" });
        return;
      }
      navigation.navigate("Nickname");
    } catch (e: unknown) {
      console.error(e);
      Alert.alert("로그인 실패", "다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [
    navigation,
    replaceOnboardingData,
    setOnboardingDone,
    setToken,
    setUserId,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <AppText style={styles.wave} accessibilityLabel="파도 아이콘">
          〰️
        </AppText>
        <AppText style={styles.appName}>Dolphin Pod</AppText>
        <AppText style={styles.tagline}>
          당신의 디지털 여정,{"\n"}함께 헤엄쳐요
        </AppText>

        <Pressable
          style={({ pressed }) => [
            styles.googleBtn,
            loading && styles.googleBtnDisabled,
            pressed && !loading && styles.googleBtnPressed,
          ]}
          onPress={onGooglePress}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Google로 로그인"
        >
          <AppText style={styles.googleBtnText}>Google로 계속하기</AppText>
        </Pressable>

        <AppText style={styles.legal}>
          로그인하면 서비스 이용 약관 및 개인정보 보호정책에 동의하게 됩니다
        </AppText>
      </View>
      <LoadingOverlay
        visible={loading}
        title="로그인 중이에요"
        message="계정 인증과 사용자 정보를 확인하는 중이에요."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  wave: {
    fontSize: 40,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    color: MAIN,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 26,
    color: "#444444",
    textAlign: "center",
    marginBottom: 40,
  },
  googleBtn: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: MAIN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  googleBtnDisabled: {
    opacity: 0.7,
  },
  googleBtnPressed: {
    opacity: 0.9,
  },
  googleBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
  },
  legal: {
    marginTop: 24,
    fontSize: 12,
    lineHeight: 18,
    color: "#888888",
    textAlign: "center",
  },
});
