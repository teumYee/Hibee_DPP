import React, { useCallback, useMemo, useRef } from "react";
import {
  Animated,
  type ImageSourcePropType,
  Pressable,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";

const PRESS_DURATION_MS = 100;

/** 기본 1 = 화면 너비의 1/6. 0.75·0.5는 그 비율로 축소 */
export type IconButtonSizeScale = 1 | 0.75 | 0.5;

export type IconButtonProps = {
  /** `require("../assets/icons/foo.png")` 등 */
  source: ImageSourcePropType;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** 기본 `1` — `(windowWidth / 6) * sizeScale` */
  sizeScale?: IconButtonSizeScale;
  /** 루트 Pressable에 추가 스타일 */
  style?: StyleProp<ViewStyle>;
};

/**
 * Aseprite 등에서 뽑은 고해상도(예: 96×96) PNG를 `src/assets/icons/`에 두고
 * 화면 너비의 1/6 크기로 표시하는 공통 아이콘 버튼.
 */
export function IconButton({
  source,
  onPress,
  disabled = false,
  accessibilityLabel,
  sizeScale = 1,
  style,
}: IconButtonProps) {
  const { width: windowWidth } = useWindowDimensions();
  const ICON_SIZE = useMemo(
    () => (windowWidth / 6) * sizeScale,
    [windowWidth, sizeScale],
  );

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animatePressed = useCallback(
    (pressed: boolean) => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: pressed ? 0.85 : 1,
          duration: PRESS_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: pressed ? 0.7 : 1,
          duration: PRESS_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacity, scale],
  );

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animatePressed(true)}
      onPressOut={() => animatePressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed: _p }) => [
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
        }}
      >
        <Animated.Image
          source={source}
          resizeMode="contain"
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            opacity,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/** 레이아웃 맞춤용 — `(width/6) * sizeScale` */
export function useIconButtonSize(sizeScale: IconButtonSizeScale = 1): number {
  const { width } = useWindowDimensions();
  return (width / 6) * sizeScale;
}
