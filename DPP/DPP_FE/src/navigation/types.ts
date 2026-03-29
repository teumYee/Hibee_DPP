// Navigation param lists — 각 Navigator의 Screen `name`과 키가 동일해야 함.
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { CheckinPattern, SelectedPattern } from "../features/checkin/types";
import type { Achievement } from "../services/api/achievements.api";

/** 온보딩·설정 재편집 공통 — `isEditMode: true`면 진행 바 숨김·저장 후 뒤로 */
export type OnboardingEditModeParams = {
  isEditMode?: boolean;
};

/** 초기 설정 마지막 단계에서 전달 — 서버 카테고리 요약 */
export type OnboardingFocusCategoryItem = {
  id: string;
  name: string;
  icon?: string;
  app_count: number;
};

/** `OnboardingStack` — 온보딩 플로우 */
export type OnboardingStackParamList = {
  Story: undefined;
  AppIntro: undefined;
  Permission: undefined;
  Login: undefined;
  Nickname: undefined;
  InitialGoals: OnboardingEditModeParams;
  InitialActiveTime: OnboardingEditModeParams;
  InitialNightTime: OnboardingEditModeParams;
  InitialStruggles: undefined;
  InitialCategories: OnboardingEditModeParams;
  InitialFocusCategory: { categories: OnboardingFocusCategoryItem[] };
};

/**
 * 메인 앱 스택 (탭 제거 후 단일 native-stack)
 * RootNavigator의 `Main` 화면에 nested 로 연결
 */
export type MainStackParamList = {
  Home: undefined;
  Dashboard: undefined;
  Calendar: undefined;
  Social: undefined;
  Challenge: undefined;
  Settings: undefined;
  Store: undefined;
  Profile: undefined;
  Achievements: undefined;
  AchievementDetail: { achievement: Achievement };
  SettingsEditGoals: OnboardingEditModeParams;
  SettingsEditNightTime: OnboardingEditModeParams;
  SettingsEditActiveTime: OnboardingEditModeParams;
  SettingsEditCategories: OnboardingEditModeParams;
  Report: undefined;
  DailyReport: { date: string };
  WeeklyReport: { weekId: string; startDate: string; endDate: string };
  CheckinIntro: undefined;
  CheckinPattern: {
    patterns: CheckinPattern[];
    currentIndex: number;
    selected: SelectedPattern[];
  };
  CheckinComplete: { selected: SelectedPattern[] };
};

/*
 * @deprecated — 이전 bottom-tabs 구조 (MainTabs.tsx 보관용)
export type MainTabParamList = {
  Home: undefined;
  Dashboard: undefined;
  Calendar: undefined;
  Social: undefined;
  Challenge: undefined;
  Settings: undefined;
};
*/

/** `RootNavigator` — native stack */
export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainStackParamList> | undefined;
  /** 개발·테스트용 — `navigation.navigate('UsageStatsTest')` */
  UsageStatsTest: undefined;
};
