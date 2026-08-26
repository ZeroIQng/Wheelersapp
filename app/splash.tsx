import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as NativeSplash from "expo-splash-screen";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { publicEntryRoute, type VariantPublicRoute } from "@/lib/app-variant";
import { useAuth } from "@/lib/auth";
import {
  clearLogoutPending,
  getAuthenticatedRoute,
  readLogoutPending,
  readStoredAuthState,
  type AuthenticatedRoute,
} from "@/lib/auth-state";
import { prefetchRiderHistory } from "@/lib/rider-history";
import { prefetchWalletOverview } from "@/lib/wallet-overview";

type SplashRoute = VariantPublicRoute | AuthenticatedRoute;

/**
 * Keep the brand splash on screen for at least this long. Auth state usually
 * resolves in a few hundred ms, which would flash the artwork and leave — the
 * splash is meant to be seen, so navigation waits out the remainder.
 */
const MIN_SPLASH_MS = 1600;

function prefetchHomeData(getAccessToken: () => Promise<string | null | undefined>) {
  void prefetchRiderHistory(getAccessToken);
  void prefetchWalletOverview(getAccessToken);
}

export default function SplashScreen() {
  const router = useRouter();
  const { getAccessToken, isReady } = useAuth();
  const hasNavigated = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(href: SplashRoute) {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    const remaining = MIN_SPLASH_MS - (Date.now() - mountedAtRef.current);
    if (remaining <= 0) {
      router.replace(href);
      return;
    }

    navTimerRef.current = setTimeout(() => router.replace(href), remaining);
  }

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isReady || hasNavigated.current) return;

    let cancelled = false;

    void (async () => {
      if (await readLogoutPending()) {
        await clearLogoutPending();
        if (!cancelled && !hasNavigated.current) {
          navigate(publicEntryRoute);
        }
        return;
      }

      const storedAuthState = await readStoredAuthState();
      if (cancelled || hasNavigated.current) return;

      if (storedAuthState) {
        const route = getAuthenticatedRoute(storedAuthState);
        if (route === "/rider") {
          prefetchHomeData(getAccessToken);
        }
        navigate(route);
        return;
      }

      // No stored state — check if we have a valid token
      const token = await getAccessToken();
      if (cancelled || hasNavigated.current) return;

      if (!token) {
        navigate(publicEntryRoute);
        return;
      }

      // Have a token but no state — go to role selection to restore
      navigate(publicEntryRoute);
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isReady, router]);

  // Fallback timer in case auth check takes too long
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasNavigated.current) {
        navigate(publicEntryRoute);
      }
    }, MIN_SPLASH_MS + 900);

    return () => clearTimeout(timer);
  }, []);

  return <SplashShell onContinue={() => navigate(publicEntryRoute)} />;
}

/**
 * The two brand splash artworks. One is chosen at random on every cold start,
 * so the app opens on either the cream or the dark treatment.
 *
 * Each entry carries the artwork's own background colour so the screen behind
 * it matches exactly — the image is drawn with resizeMode="contain", and the
 * matching backdrop makes the letterboxing invisible on any aspect ratio.
 */
const SPLASH_VARIANTS = [
  {
    key: "light",
    source: require("../assets/images/splash-light.png"),
    background: "#FEFAEF",
    statusBar: "dark" as const,
  },
  {
    key: "dark",
    source: require("../assets/images/splash-dark.png"),
    background: "#202020",
    statusBar: "light" as const,
  },
];

function pickSplashVariant() {
  return SPLASH_VARIANTS[Math.floor(Math.random() * SPLASH_VARIANTS.length)];
}

function SplashShell({ onContinue }: { onContinue: () => void }) {
  // Chosen once per mount via the lazy initialiser — re-renders must not
  // reshuffle the artwork mid-splash.
  const [variant] = useState(pickSplashVariant);

  useEffect(() => {
    // Hide the native splash now that the custom splash is visible
    NativeSplash.hideAsync();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: variant.background }]}>
      <StatusBar style={variant.statusBar} backgroundColor={variant.background} />
      <Pressable
        accessibilityLabel="Continue"
        accessibilityRole="button"
        onPress={onContinue}
        style={styles.pressable}
      >
        <Animated.View entering={FadeIn.duration(350)} style={styles.artWrap}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={variant.source}
            style={styles.art}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  artWrap: {
    width: "100%",
    height: "100%",
  },
  art: {
    width: "100%",
    height: "100%",
  },
});
