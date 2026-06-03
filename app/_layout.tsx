import "fast-text-encoding";
import "react-native-reanimated";

import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, TextInput, useColorScheme } from "react-native";

// Cap Dynamic Type scaling globally so layouts don't break on devices
// with large accessibility text (especially smaller screens like iPhone 14).
(Text as any).defaultProps = {
  ...(Text as any).defaultProps,
  maxFontSizeMultiplier: 1.2,
};
(TextInput as any).defaultProps = {
  ...(TextInput as any).defaultProps,
  maxFontSizeMultiplier: 1.2,
};

import { AppLockOverlay, AppLockProvider } from "@/lib/app-lock";
import { LocationProvider } from "@/lib/location";
import { AppNotificationsProvider } from "@/lib/notifications";
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
    return (
      <AppLockProvider>
        {withWalletKit}
        <AppLockOverlay onForgotPin={async () => undefined} />
      </AppLockProvider>
    );
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
      <LocationProvider>
        <RideSessionProvider>
          <AppNotificationsProvider>
            <AppLockProvider>
              {withWalletKit}
              <PrivyAppLockOverlay />
            </AppLockProvider>
          </AppNotificationsProvider>
        </RideSessionProvider>
      </LocationProvider>
    </PrivyProvider>
  );
}

function PrivyAppLockOverlay() {
  const { logout } = usePrivy();

  return <AppLockOverlay onForgotPin={logout} />;
}
