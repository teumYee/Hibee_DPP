import React, { useEffect, useState } from "react";
import { RootNavigator } from "../../navigation/RootNavigator";
import { useAuthStore } from "../../store/auth.store";
import {
  scheduleCheckinNotification,
} from "../../features/checkin/services/checkinNotification";
import { getUserBootstrap } from "../../services/api/main.api";
import { HttpError } from "../../services/api/client";
import { syncNativeUsagePolicy } from "../../features/usage/services/dailyUsage";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function AppBootstrap() {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setUserId = useAuthStore((s) => s.setUserId);
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);
  const replaceOnboardingData = useAuthStore((s) => s.replaceOnboardingData);
  const logout = useAuthStore((s) => s.logout);

  console.log("token =", useAuthStore.getState().token);

  useEffect(() => {
    (async () => {
      await hydrate();
      try {
        const { token } = useAuthStore.getState();
        if (token) {
          const bootstrap = await getUserBootstrap();
          await setUserId(bootstrap.user_id);
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
        }
        await syncNativeUsagePolicy();
        const night = useAuthStore.getState().onboardingData.night_mode_start;
        if (night) {
          await scheduleCheckinNotification(night);
        }
      } catch (e) {
        if (e instanceof HttpError && e.status === 401) {
          await logout();
        }
        console.warn("[AppBootstrap] checkin notification schedule failed", e);
      }
      setReady(true);
    })();
  }, [hydrate, logout, replaceOnboardingData, setOnboardingDone, setUserId]);

  if (!ready) {
    return (
      <LoadingOverlay
        visible
        title="앱을 준비하고 있어요"
        message="계정 정보와 오늘의 설정을 불러오는 중이에요."
      />
    );
  }

  return <RootNavigator />;
}
