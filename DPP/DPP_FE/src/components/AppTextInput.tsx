import React, { forwardRef } from "react";
import {
  TextInput as RNTextInput,
  type TextInputProps,
} from "react-native";
import { appFontFamily } from "../theme/typography";

export const AppTextInput = forwardRef<RNTextInput, TextInputProps>(
  function AppTextInput({ style, ...rest }, ref) {
    return (
      <RNTextInput ref={ref} {...rest} style={[appFontFamily, style]} />
    );
  },
);
