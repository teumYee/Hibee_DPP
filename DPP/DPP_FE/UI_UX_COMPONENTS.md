# UI/UX 컴포넌트 인벤토리

현재 `DPP_FE/src` 기준으로, UI/UX와 직접 연결되는 공용 컴포넌트, 기능별 컴포넌트, 화면, 네비게이션 구성을 정리한 문서입니다.

## 1. 공용 컴포넌트

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/components/AppText.tsx` | `AppText` | 앱 전역 기본 텍스트 래퍼 | `Text`에 공통 폰트를 적용해 타이포그래피 일관성을 유지합니다. |
| `src/components/AppTextInput.tsx` | `AppTextInput` | 앱 전역 기본 입력 필드 | `TextInput`에 공통 폰트를 적용합니다. |
| `src/components/IconButton.tsx` | `IconButton`, `useIconButtonSize` | 아이콘 기반 버튼 | PNG 아이콘 탭 버튼을 렌더링하고, 눌림 애니메이션과 반응형 크기 계산을 제공합니다. |
| `src/components/LoadingOverlay.tsx` | `LoadingOverlay` | 공통 로딩 팝업 | 반투명 배경 위 카드, 스피너, 제목, 메시지를 보여주는 모달형 로딩 UI입니다. |

## 2. 기능별 컴포넌트

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/dashboard/components/DashboardAppIcon.tsx` | `DashboardAppIcon` | 대시보드 앱 아이콘 표시 | Android 네이티브 모듈에서 앱 아이콘을 가져오고, 실패 시 폴백 UI를 보여줍니다. |
| `src/features/onboarding/components/OnboardingStepLayout.tsx` | `OnboardingStepLayout` | 온보딩 공통 레이아웃 | 단계 표시, 진행 바, 제목/부제, 본문, 푸터를 공통 구조로 제공합니다. |
| `src/features/report/components/ReportVisuals.tsx` | `TimeFlowChart`, `MetricGrid`, `HorizontalBarList`, `TimelineBarChart`, `UsageTrendChart`, `DonutCategoryChart` | 리포트 시각화 묶음 | 일간/주간 리포트에서 재사용하는 차트, 메트릭 카드, 막대 리스트, 도넛 차트를 제공합니다. |

## 3. 네비게이션

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/navigation/RootNavigator.tsx` | `RootNavigator` | 앱 최상위 라우팅 | 로그인 여부와 온보딩 완료 여부에 따라 `Onboarding` 또는 `Main` 흐름으로 분기합니다. |
| `src/navigation/MainStack.tsx` | `MainStack` | 메인 앱 스택 | 홈, 대시보드, 체크인, 리포트, 캘린더, 소셜, 설정 등 주요 화면을 연결합니다. |
| `src/navigation/OnboardingStack.tsx` | `OnboardingStack` | 온보딩 스택 | 스토리, 권한, 로그인, 닉네임, 초기 설정 관련 화면을 순차적으로 연결합니다. |
| `src/navigation/MainTabs.tsx` | `MainTabs` | 과거 탭 구조 참고 파일 | 현재는 사실상 비활성/폐기 상태이며, 실제 메인 구조는 `MainStack` 중심입니다. |

## 4. 화면 인벤토리

### 4.1 온보딩

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/onboarding/screens/StoryScreen.tsx` | `StoryScreen` | 앱 스토리 소개 | 여러 슬라이드로 앱의 세계관과 흐름을 소개합니다. |
| `src/features/onboarding/screens/AppIntroScreen.tsx` | `AppIntroScreen` | 앱 철학 소개 | 앱의 가치와 작동 방식을 카드 형태로 설명합니다. |
| `src/features/onboarding/screens/PermissionScreen.tsx` | `PermissionScreen` | 권한 유도 | 사용 기록 접근 권한의 필요성을 설명하고 설정 이동을 유도합니다. |
| `src/features/onboarding/screens/LoginScreen.tsx` | `LoginScreen` | 로그인 | Google 로그인과 사용자 bootstrap 로직을 수행합니다. |
| `src/features/onboarding/screens/NicknameScreen.tsx` | `NicknameScreen` | 닉네임 설정 | 닉네임 입력/추천 및 저장을 담당합니다. |
| `src/features/onboarding/screens/InitialGoalsScreen.tsx` | `InitialGoalsScreen` | 초기 목표 선택 | 사용자의 목표를 선택해 온보딩 데이터에 저장합니다. |
| `src/features/onboarding/screens/InitialActiveTimeScreen.tsx` | `InitialActiveTimeScreen` | 활동 시간 선택 | 사용자의 주 활동 시간대를 선택합니다. |
| `src/features/onboarding/screens/InitialNightTimeScreen.tsx` | `InitialNightTimeScreen` | 심야/체크인 정책 설정 | 심야 구간과 체크인 시간 정책을 시각적으로 설정합니다. |
| `src/features/onboarding/screens/InitialStrugglesScreen.tsx` | `InitialStrugglesScreen` | 어려움 선택 | 사용자가 겪는 디지털 사용 어려움을 다중 선택합니다. |
| `src/features/onboarding/screens/InitialCategoriesScreen.tsx` | `InitialCategoriesScreen` | 앱 카테고리 확인 | 설치 앱 카테고리를 불러와 검토/조정합니다. |
| `src/features/onboarding/screens/InitialFocusCategoryScreen.tsx` | `InitialFocusCategoryScreen` | 집중 카테고리 선택 | 이후 분석에 집중할 카테고리를 고릅니다. |
| `src/features/onboarding/screens/InitialSetupScreen.tsx` | `InitialSetupScreen` | 임시 초기 설정 화면 | 현재는 최소 기능만 있는 플레이스홀더 성격의 화면입니다. |

### 4.2 체크인

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/checkin/screens/CheckinIntroScreen.tsx` | `CheckinIntroScreen` | 체크인 진입 | 체크인 가능 여부를 확인하고, 패턴/스냅샷 준비 후 다음 단계로 이동합니다. |
| `src/features/checkin/screens/CheckinPatternScreen.tsx` | `CheckinPatternScreen` | 패턴 선택과 KPT 태깅 | 패턴 후보를 순회하며 Keep/Problem/Try로 분류합니다. |
| `src/features/checkin/screens/CheckinCompleteScreen.tsx` | `CheckinCompleteScreen` | 체크인 완료 및 리포트 연결 | 체크인을 저장하고 일간 리포트 화면으로 연결합니다. |

### 4.3 리포트

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/report/screens/ReportScreen.tsx` | `ReportScreen` | 리포트 허브 플레이스홀더 | 현재는 준비 중 상태를 보여주는 화면입니다. |
| `src/features/report/screens/DailyReportScreen.tsx` | `DailyReportScreen` | 일간 리포트 표시 | 핵심 수치, 시간 흐름, 카테고리, 상위 앱, 타임라인, KPT, 회고 텍스트를 보여줍니다. |
| `src/features/report/screens/WeeklyReportScreen.tsx` | `WeeklyReportScreen` | 주간 리포트 표시 | 주간 핵심 수치, 7일 추이, 시간대 패턴, 상위 앱/카테고리, 주간 회고를 보여줍니다. |

### 4.4 대시보드

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/dashboard/screens/DashboardScreen.tsx` | `DashboardScreen` | 오늘 사용 현황 요약 | 총 사용 시간, 언락 수, 연속 사용, 상위 앱 등 오늘의 상태를 요약합니다. |

### 4.5 캘린더

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/calendar/screens/CalendarScreen.tsx` | `CalendarScreen` | 날짜별 기록 탐색 | 월간 캘린더에서 날짜를 선택하고 일간/주간 리포트로 이동할 수 있습니다. |
| `src/features/calendar/screens/DailyCheckinScreen.tsx` | `DailyCheckinScreen` | 일별 체크인 관련 화면 예정 | 현재는 실질 구현이 없는 플레이스홀더 파일입니다. |
| `src/features/calendar/screens/SummaryScreen.tsx` | `SummaryScreen` | 요약 화면 예정 | 현재는 실질 구현이 없는 플레이스홀더 파일입니다. |

### 4.6 소셜

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/social/screens/SocialScreen.tsx` | `SocialScreen` | 소셜 허브 | 친구 목록, 그룹, 응원 등 소셜 기능의 메인 진입점입니다. |
| `src/features/social/screens/FriendsScreen.tsx` | `FriendsScreen` | 친구 화면 예정 | 현재는 실질 구현이 없는 플레이스홀더 파일입니다. |
| `src/features/social/screens/GroupDetailScreen.tsx` | `GroupDetailScreen` | 그룹 상세 예정 | 현재는 실질 구현이 없는 플레이스홀더 파일입니다. |

### 4.7 업적

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/achievements/screens/AchievementsScreen.tsx` | `AchievementsScreen` | 업적 목록 | 업적 진행도와 달성 현황을 보여줍니다. |
| `src/features/achievements/screens/AchievementDetailScreen.tsx` | `AchievementDetailScreen` | 업적 상세 | 단일 업적의 설명, 달성 상태, 보상 정보를 보여줍니다. |

### 4.8 챌린지

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/challenge/screens/ChallengeScreen.tsx` | `ChallengeScreen` | 챌린지 메인 예정 | 현재는 준비 중 플레이스홀더입니다. |
| `src/features/challenge/screens/ChallengeBoardScreen.tsx` | `ChallengeBoardScreen` | 챌린지 보드 예정 | 현재는 실질 구현이 없는 플레이스홀더 파일입니다. |

### 4.9 홈 / 설정 / 프로필 / 스토어

| 경로 | 이름 | 용도 | 기능 |
|---|---|---|---|
| `src/features/home/screens/HomeScreen.tsx` | `HomeScreen` | 메인 홈 | 바다/물고기 비주얼과 핵심 이동 동선을 제공하는 홈 화면입니다. |
| `src/features/settings/screens/SettingsScreen.tsx` | `SettingsScreen` | 설정 관리 | 로그아웃, 데이터 초기화, 닉네임/정책 편집 진입 등 설정 기능을 제공합니다. |
| `src/features/profile/screens/ProfileScreen.tsx` | `ProfileScreen` | 프로필 화면 예정 | 현재는 준비 중 플레이스홀더입니다. |
| `src/features/store/screens/StoreScreen.tsx` | `StoreScreen` | 인게임 스토어 | 아이템 목록, 코인, 구매 플로우를 보여줍니다. |

## 5. 현재 상태 메모

- 실제로 재사용성이 높은 핵심 UI 컴포넌트는 `AppText`, `AppTextInput`, `OnboardingStepLayout`, `LoadingOverlay`, `ReportVisuals`입니다.
- 리포트, 체크인, 온보딩은 비교적 구조화되어 있지만, 소셜/챌린지/캘린더 일부 화면은 아직 플레이스홀더 성격이 남아 있습니다.
- `ReportScreen`, `ProfileScreen`, `ChallengeScreen`은 현재 “준비 중” 상태의 허브/메인 화면입니다.
- `DailyCheckinScreen`, `SummaryScreen`, `FriendsScreen`, `GroupDetailScreen`, `ChallengeBoardScreen`은 사실상 미구현 파일로 보는 편이 맞습니다.
