// Google 로그인
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";
import { useAuthStore } from "../../../store/auth.store";
import { ENDPOINTS } from "../../../services/api/endpoints";
import { post } from "../../../services/api/client";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Login">;

const MAIN = "#2E7FC1";
const BG = "#FFFFFF";

const WEB_CLIENT_ID =
  "46727891240-lvl9m32kma1fn5tr09ad1dbmiu9v75ip.apps.googleusercontent.com";

type GoogleLoginResponse = {
  id: number;
  email: string;
  nickname: string;
  message: string;
};

export function LoginScreen({ navigation }: Props) {
  const setToken = useAuthStore((s) => s.setToken);
  const setUserId = useAuthStore((s) => s.setUserId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });
  }, []);

  const onGooglePress = useCallback(async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
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
      await setToken(idToken);
      await setUserId(loginResult.id);
      navigation.navigate("Nickname");
    } catch (e: unknown) {
      console.error(e);
      Alert.alert("로그인 실패", "다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [navigation, setToken, setUserId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <Text style={styles.wave} accessibilityLabel="파도 아이콘">
          〰️
        </Text>
        <Text style={styles.appName}>Dolphin Pod</Text>
        <Text style={styles.tagline}>
          당신의 디지털 여정,{"\n"}함께 헤엄쳐요
        </Text>

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
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.googleBtnText}>Google로 계속하기</Text>
          )}
        </Pressable>

        <Text style={styles.legal}>
          로그인하면 서비스 이용 약관 및 개인정보 보호정책에 동의하게 됩니다
        </Text>
      </View>
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
    fontWeight: "800",
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
    fontWeight: "700",
  },
  legal: {
    marginTop: 24,
    fontSize: 12,
    lineHeight: 18,
    color: "#888888",
    textAlign: "center",
  },
});
