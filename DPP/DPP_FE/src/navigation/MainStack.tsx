// 메인 앱 — 단일 native stack (탭 대체)
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { MainStackParamList } from "./types";

import { HomeScreen } from "../features/home/screens/HomeScreen";
import { DashboardScreen } from "../features/dashboard/screens/DashboardScreen";
import { CalendarScreen } from "../features/calendar/screens/CalendarScreen";
import { SocialScreen } from "../features/social/screens/SocialScreen";
import { ChallengeScreen } from "../features/challenge/screens/ChallengeScreen";
import { SettingsScreen } from "../features/settings/screens/SettingsScreen";
import { StoreScreen } from "../features/store/screens/StoreScreen";
import { ProfileScreen } from "../features/profile/screens/ProfileScreen";
import { AchievementsScreen } from "../features/achievements/screens/AchievementsScreen";
import { ReportScreen } from "../features/report/screens/ReportScreen";
import { DailyReportScreen } from "../features/report/screens/DailyReportScreen";
import { WeeklyReportScreen } from "../features/report/screens/WeeklyReportScreen";
import { CheckinIntroScreen } from "../features/checkin/screens/CheckinIntroScreen";
import { CheckinPatternScreen } from "../features/checkin/screens/CheckinPatternScreen";
import { CheckinCompleteScreen } from "../features/checkin/screens/CheckinCompleteScreen";
import { AchievementDetailScreen } from "../features/achievements/screens/AchievementDetailScreen";
import { InitialGoalsScreen } from "../features/onboarding/screens/InitialGoalsScreen";
import { InitialNightTimeScreen } from "../features/onboarding/screens/InitialNightTimeScreen";
import { InitialActiveTimeScreen } from "../features/onboarding/screens/InitialActiveTimeScreen";
import { InitialCategoriesScreen } from "../features/onboarding/screens/InitialCategoriesScreen";

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="Social" component={SocialScreen} />
      <Stack.Screen name="Challenge" component={ChallengeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="DailyReport" component={DailyReportScreen} />
      <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
      <Stack.Screen name="CheckinIntro" component={CheckinIntroScreen} />
      <Stack.Screen name="CheckinPattern" component={CheckinPatternScreen} />
      <Stack.Screen name="CheckinComplete" component={CheckinCompleteScreen} />
      <Stack.Screen
        name="AchievementDetail"
        component={AchievementDetailScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="SettingsEditGoals"
        component={InitialGoalsScreen}
        initialParams={{ isEditMode: true }}
      />
      <Stack.Screen
        name="SettingsEditNightTime"
        component={InitialNightTimeScreen}
        initialParams={{ isEditMode: true }}
      />
      <Stack.Screen
        name="SettingsEditActiveTime"
        component={InitialActiveTimeScreen}
        initialParams={{ isEditMode: true }}
      />
      <Stack.Screen
        name="SettingsEditCategories"
        component={InitialCategoriesScreen}
        initialParams={{ isEditMode: true }}
      />
    </Stack.Navigator>
  );
}
