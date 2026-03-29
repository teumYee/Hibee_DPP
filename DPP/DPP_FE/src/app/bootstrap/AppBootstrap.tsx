// 앱 시작 시, 로딩-로그인 온보딩 완료 여부 확인하고 루트 네비로 진입
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootNavigator } from "../../navigation/RootNavigator";
import { useAuthStore } from "../../store/auth.store";
import {
  NIGHT_START_TIME_KEY,
  scheduleCheckinNotification,
} from "../../features/checkin/services/checkinNotification";

export function AppBootstrap() {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    (async () => {
      await hydrate();
      try {
        const night = await AsyncStorage.getItem(NIGHT_START_TIME_KEY);
        if (night) {
          await scheduleCheckinNotification(night);
        }
      } catch (e) {
        console.warn("[AppBootstrap] checkin notification schedule failed", e);
      }
      setReady(true);
    })();
  }, [hydrate]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <RootNavigator />;
}
