/**
 * @format
 */

import React, { useEffect } from "react";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { configureGoogleSignIn } from "./config/googleSignIn";
import { AppProviders } from "./providers/AppProviders";
import { AppBootstrap } from "./bootstrap/AppBootstrap";

export default function App() {
  const isDarkMode = useColorScheme() === "dark";

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <AppProviders>
        <AppBootstrap />
      </AppProviders>
    </SafeAreaProvider>
  );
}
