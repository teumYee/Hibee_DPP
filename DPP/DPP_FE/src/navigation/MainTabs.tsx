/*
 * @deprecated — bottom tab 네비게이션은 MainStack.tsx 단일 스택으로 대체됨.
 * 참고용으로만 보관합니다.

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";

import { HomeScreen } from "../features/home/screens/HomeScreen";
import { DashboardScreen } from "../features/dashboard/screens/DashboardScreen";
import { CalendarScreen } from "../features/calendar/screens/CalendarScreen";
import { SocialBoardScreen } from "../features/social/screens/SocialBoardScreen";
import { ChallengeBoardScreen } from "../features/challenge/screens/ChallengeBoardScreen";
import { SettingsScreen } from "../features/settings/screens/SettingsScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Social" component={SocialBoardScreen} />
      <Tab.Screen name="Challenge" component={ChallengeBoardScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
*/

export {};
