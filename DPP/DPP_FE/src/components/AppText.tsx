import React, { forwardRef } from "react";
import { Text as RNText, type TextProps } from "react-native";
import { appFontFamily } from "../theme/typography";

export const AppText = forwardRef<RNText, TextProps>(function AppText(
  { style, ...rest },
  ref,
) {
  return <RNText ref={ref} {...rest} style={[appFontFamily, style]} />;
});
