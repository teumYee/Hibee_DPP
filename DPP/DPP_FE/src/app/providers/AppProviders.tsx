import React from "react";
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from "@react-navigation/native";
import { APP_FONT_FAMILY } from "../../theme/typography";

type Props = { children: React.ReactNode };

const appNavTheme = {
  ...DefaultTheme,
  fonts: {
    regular: { fontFamily: APP_FONT_FAMILY },
    medium: { fontFamily: APP_FONT_FAMILY },
    bold: { fontFamily: APP_FONT_FAMILY },
    heavy: { fontFamily: APP_FONT_FAMILY },
  },
} as Theme;

export function AppProviders({ children }: Props) {
  return (
    <NavigationContainer theme={appNavTheme}>{children}</NavigationContainer>
  );
}
