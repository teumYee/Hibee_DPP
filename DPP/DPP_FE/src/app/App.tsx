/**
 * @format
 */

import React from "react";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "./providers/AppProviders";
import { AppBootstrap } from "./bootstrap/AppBootstrap";

export default function App() {
  const isDarkMode = useColorScheme() === "dark";

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <AppProviders>
        <AppBootstrap />
      </AppProviders>
    </SafeAreaProvider>
  );
}
