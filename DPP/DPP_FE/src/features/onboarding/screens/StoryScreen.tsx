// 온보딩 스토리 (7슬라이드)
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Story">;

type StorySlide = {
  /** 그라데이션 시작색 — LinearGradient 미설치 시 배경으로 사용 */
  gradientStart: string;
  /** 그라데이션 끝색 — TODO: LinearGradient 설치 후 colors에 사용 */
  gradientEnd: string;
  title: string;
  subtitle: string;
};

const SLIDES: StorySlide[] = [
  {
    gradientStart: "#050D1A",
    gradientEnd: "#0A2240",
    title: "눈을 떴습니다",
    subtitle: "여기가 어디인지\n아직 잘 모르겠지만",
  },
  {
    gradientStart: "#0A2240",
    gradientEnd: "#1B4F8A",
    title: "바다입니다",
    subtitle: "끝없이 넓고\n끝없이 깊은 곳",
  },
  {
    gradientStart: "#1B4F8A",
    gradientEnd: "#2E7FC1",
    title: "당신은 돌고래입니다",
    subtitle: "이 바다를 탐험하고\n자유롭게 헤엄칠 수 있는",
  },
  {
    gradientStart: "#1B4F8A",
    gradientEnd: "#0D2E5C",
    title: "하지만 바다는 늘 잔잔하지 않아요",
    subtitle: "도파민의 파도가\n당신을 흔들어놓을 때도 있습니다",
  },
  {
    gradientStart: "#0D2E5C",
    gradientEnd: "#081A3D",
    title: "길을 잃을 때도 있고",
    subtitle: "어느새 나도 모르게\n깊은 곳으로 끌려가기도 하죠",
  },
  {
    gradientStart: "#0A3060",
    gradientEnd: "#1A6B8A",
    title: "그래도 괜찮아요",
    subtitle: "Pod가 있으니까요\n함께 헤엄치는 돌고래 무리",
  },
  {
    gradientStart: "#1A5C8A",
    gradientEnd: "#2A8FAD",
    title: "이제, 시작해볼까요?",
    subtitle: "당신만의 리듬으로\n이 바다를 헤엄쳐봐요",
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function StorySlideContent({
  slide,
  isActive,
}: {
  slide: StorySlide;
  isActive: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [isActive, opacity]);

  return (
    <Animated.View style={[styles.textBlock, { opacity }]}>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.subtitle}>{slide.subtitle}</Text>
    </Animated.View>
  );
}

export function StoryScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = useCallback(() => {
    navigation.navigate("AppIntro");
  }, [navigation]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / SCREEN_WIDTH);
      const clamped = Math.min(Math.max(idx, 0), SLIDES.length - 1);
      setCurrentIndex(clamped);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<StorySlide>) => (
      <View
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        // TODO: LinearGradient 설치 후 아래 View 대신
        // <LinearGradient colors={[item.gradientStart, item.gradientEnd]} style={StyleSheet.absoluteFill} />
        accessibilityLabel={`스토리 슬라이드 ${index + 1}`}
      >
        {/* TODO: react-native-linear-gradient 설치 후 LinearGradient로 교체 (colors: gradientStart → gradientEnd) */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: item.gradientStart },
          ]}
        />
        <StorySlideContent slide={item} isActive={index === currentIndex} />
      </View>
    ),
    [currentIndex],
  );

  const keyExtractor = useCallback((_: StorySlide, index: number) => {
    return `story-slide-${index}`;
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<StorySlide> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  const showSkip = currentIndex < 6;
  const showCta = currentIndex === 6;

  return (
    <View style={styles.root}>
      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={getItemLayout}
        decelerationRate="fast"
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <SafeAreaView style={styles.skipSafe} edges={["top"]}>
          {showSkip ? (
            <Pressable
              onPress={goNext}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="온보딩 건너뛰기"
            >
              <Text style={styles.skipText}>건너뛰기</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </SafeAreaView>

        <View style={styles.bottomArea}>
          {showCta ? (
            <Pressable
              style={styles.ctaButton}
              onPress={goNext}
              accessibilityRole="button"
              accessibilityLabel="바다로 뛰어들기"
            >
              <Text style={styles.ctaButtonText}>바다로 뛰어들기</Text>
            </Pressable>
          ) : (
            <View style={styles.ctaPlaceholder} />
          )}

          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => {
              const active = i === currentIndex;
              return (
                <View
                  key={`dot-${i}`}
                  style={[
                    styles.dot,
                    active ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050D1A",
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: {
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 26,
    opacity: 0.85,
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  skipSafe: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
  },
  skipPlaceholder: {
    height: 24,
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: 16,
    opacity: 0.9,
    textDecorationLine: "underline",
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: "center",
  },
  ctaPlaceholder: {
    height: 52,
    marginBottom: 16,
  },
  ctaButton: {
    width: "100%",
    maxWidth: 320,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 16,
    alignItems: "center",
  },
  ctaButtonText: {
    color: "#081A3D",
    fontSize: 17,
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  dotInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  bottomSafe: {
    minHeight: 0,
  },
});
