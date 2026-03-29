// Onboarding stack navigation component
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "./types";

import { StoryScreen } from "../features/onboarding/screens/StoryScreen";
import { AppIntroScreen } from "../features/onboarding/screens/AppIntroScreen";
import { PermissionScreen } from "../features/onboarding/screens/PermissionScreen";
import { LoginScreen } from "../features/onboarding/screens/LoginScreen";
import { NicknameScreen } from "../features/onboarding/screens/NicknameScreen";
import { InitialGoalsScreen } from "../features/onboarding/screens/InitialGoalsScreen";
import { InitialActiveTimeScreen } from "../features/onboarding/screens/InitialActiveTimeScreen";
import { InitialNightTimeScreen } from "../features/onboarding/screens/InitialNightTimeScreen";
import { InitialStrugglesScreen } from "../features/onboarding/screens/InitialStrugglesScreen";
import { InitialCategoriesScreen } from "../features/onboarding/screens/InitialCategoriesScreen";
import { InitialFocusCategoryScreen } from "../features/onboarding/screens/InitialFocusCategoryScreen";

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator
      initialRouteName="Story"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Story" component={StoryScreen} />
      <Stack.Screen name="AppIntro" component={AppIntroScreen} />
      <Stack.Screen name="Permission" component={PermissionScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Nickname" component={NicknameScreen} />
      <Stack.Screen name="InitialGoals" component={InitialGoalsScreen} />
      <Stack.Screen name="InitialActiveTime" component={InitialActiveTimeScreen} />
      <Stack.Screen name="InitialNightTime" component={InitialNightTimeScreen} />
      <Stack.Screen name="InitialStruggles" component={InitialStrugglesScreen} />
      <Stack.Screen name="InitialCategories" component={InitialCategoriesScreen} />
      <Stack.Screen name="InitialFocusCategory" component={InitialFocusCategoryScreen} />
    </Stack.Navigator>
  );
}
