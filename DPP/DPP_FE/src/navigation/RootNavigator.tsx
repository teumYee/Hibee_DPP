// Root navigator component
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";

import { OnboardingStack } from "./OnboardingStack";
import { MainStack } from "./MainStack";
import UsageStatsTestScreen from "../app/UsageStatsTestScreen";

import { useAuthStore } from "../store/auth.store";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isAuthed = useAuthStore((state) => state.isAuthed);
  const onboardingDone = useAuthStore((state) => state.onboardingDone);

  const initialRouteName: keyof RootStackParamList =
    isAuthed && onboardingDone ? "Main" : "Onboarding";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingStack} />
      <Stack.Screen name="Main" component={MainStack} />
      <Stack.Screen name="UsageStatsTest" component={UsageStatsTestScreen} />
    </Stack.Navigator>
  );
}
