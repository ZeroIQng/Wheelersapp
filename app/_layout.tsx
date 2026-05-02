import "fast-text-encoding";
import "react-native-reanimated";

import { PrivyProvider } from "@privy-io/expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { RideSessionProvider } from "@/lib/ride-session";
import { isPrivyConfigured, privyAppId, privyClientId } from "@/lib/privy";
import { ThirdwebProvider } from "@/lib/thirdweb-runtime";
import { theme } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    ClashDisplay_400Regular: require("../assets/fonts/ClashDisplay-Regular.ttf"),
    ClashDisplay_500Medium: require("../assets/fonts/ClashDisplay-Medium.ttf"),
    ClashDisplay_600Semibold: require("../assets/fonts/ClashDisplay-Semibold.ttf"),
    ClashDisplay_700Bold: require("../assets/fonts/ClashDisplay-Bold.ttf"),
    Shrikhand_400Regular: require("../assets/fonts/Shrikhand-Regular.ttf"),
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

  const withWalletKit = <ThirdwebProvider>{layout}</ThirdwebProvider>;

  if (!isPrivyConfigured || !privyAppId || !privyClientId) {
    return withWalletKit;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <RideSessionProvider>{withWalletKit}</RideSessionProvider>
    </PrivyProvider>
  );
}
