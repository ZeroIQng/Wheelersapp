import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { appKit } from '@/lib/reown';
import { theme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    ClashDisplay_400Regular: require('../assets/fonts/ClashDisplay-Regular.ttf'),
    ClashDisplay_500Medium: require('../assets/fonts/ClashDisplay-Medium.ttf'),
    ClashDisplay_600Semibold: require('../assets/fonts/ClashDisplay-Semibold.ttf'),
    ClashDisplay_700Bold: require('../assets/fonts/ClashDisplay-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const layout = (
    <>
      <StatusBar
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={colorScheme === 'dark' ? theme.colors.black : theme.colors.offWhite}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? theme.colors.black : theme.colors.offWhite,
          },
          animation: 'slide_from_right',
        }}
      />
    </>
  );

  if (!appKit) {
    return layout;
  }

  return (
    <AppKitProvider instance={appKit}>
      {layout}
      <AppKit />
    </AppKitProvider>
  );
}
