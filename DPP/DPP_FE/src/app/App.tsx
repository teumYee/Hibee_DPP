// // Main App component
// import React from 'react';
// import { AppProviders } from "./providers/AppProviders";
// import { AppBootstrap } from "./bootstrap/AppBootstrap";

// export default function App() {
//     return (
//         <AppProviders>
//             <AppBootstrap />
//         </AppProviders>
//     );
// }

/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import {StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import UsageStatsTestScreen from './UsageStatsTestScreen';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  return (
    <View style={styles.container}>
      <UsageStatsTestScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});


