import "@ethersproject/shims";
import "fast-text-encoding";
import "react-native-get-random-values";
import "react-native-reanimated";

import { PrivyProvider } from "@privy-io/expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { isPrivyConfigured, privyAppId, privyClientId } from "@/lib/privy";
import { appKit } from "@/lib/reown";
import { theme } from "@/theme";

import { AppKit, AppKitProvider } from "@reown/appkit-react-native";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    ClashDisplay_400Regular: require("../assets/fonts/ClashDisplay-Regular.ttf"),
    ClashDisplay_500Medium: require("../assets/fonts/ClashDisplay-Medium.ttf"),
    ClashDisplay_600Semibold: require("../assets/fonts/ClashDisplay-Semibold.ttf"),
    ClashDisplay_700Bold: require("../assets/fonts/ClashDisplay-Bold.ttf"),
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
        style={colorScheme === "dark" ? "light" : "dark"}
        backgroundColor={
          colorScheme === "dark" ? theme.colors.black : theme.colors.offWhite
        }
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? theme.colors.black
                : theme.colors.offWhite,
          },
          animation: "slide_from_right",
        }}
      />
    </>
  );

  const withWalletKit = appKit ? (
    <AppKitProvider instance={appKit}>
      {layout}
      <AppKit />
    </AppKitProvider>
  ) : (
    layout
  );

  if (!isPrivyConfigured || !privyAppId || !privyClientId) {
    return withWalletKit;
  }

  return (
    <PrivyProvider appId={privyAppId} clientId={privyClientId}>
      {withWalletKit}
    </PrivyProvider>
  );
}
