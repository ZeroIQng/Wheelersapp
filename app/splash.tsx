import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as NativeSplash from "expo-splash-screen";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { BrandLogo } from "@/components/brand-logo";

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
const MIN_SPLASH_MS = 900;

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
    }, MIN_SPLASH_MS + 1200);

    return () => clearTimeout(timer);
  }, []);

  return <SplashShell onContinue={() => navigate(publicEntryRoute)} />;
}

/**
 * One splash, three moods. The native splash is a constant frame — the tile
 * mark on brand orange — and this screen OPENS on that exact frame, so the
 * native→JS handoff is invisible (this is what killed the "splash shows
 * twice" effect: the old native wordmark was theme-fixed while JS
 * randomized, so half the launches visibly flipped). Only after the handoff
 * does the randomly chosen variant fade in — and one launch in three the
 * variant IS the orange frame, so nothing moves at all.
 */
const SPLASH_VARIANTS = [
  {
    key: "brand",
    background: "#FF7700",
    tile: false, // the screen is the tile — glyph only
    glyph: "#FFF8EC",
    name: "#FFF8EC",
    statusBar: "light" as const,
  },
  {
    key: "cream",
    background: "#FFF8EC",
    tile: true,
    glyph: "#FFF8EC",
    name: "#0D0D0D",
    statusBar: "dark" as const,
  },
  {
    key: "ink",
    background: "#0D0D0D",
    tile: true,
    glyph: "#FFF8EC",
    name: "#FFF8EC",
    statusBar: "light" as const,
  },
];

const IS_DRIVER = process.env.EXPO_PUBLIC_APP_VARIANT === "driver";

function pickSplashVariant() {
  return SPLASH_VARIANTS[Math.floor(Math.random() * SPLASH_VARIANTS.length)];
}

function SplashMark({ variant }: { variant: (typeof SPLASH_VARIANTS)[number] }) {
  return (
    <View style={styles.markWrap}>
      <BrandLogo
        size={120}
        showTile={variant.tile}
        tileColor="#FF7700"
        glyphColor={variant.glyph}
      />
      <View style={styles.nameWrap}>
        <AppNameText color={variant.name} />
      </View>
    </View>
  );
}

function AppNameText({ color }: { color: string }) {
  return (
    <View style={styles.nameRow}>
      <Animated.Text style={[styles.nameText, { color }]}>Wheelers</Animated.Text>
      {IS_DRIVER ? (
        <Animated.Text style={[styles.driverTag, { color }]}>DRIVER</Animated.Text>
      ) : null}
    </View>
  );
}

function SplashShell({ onContinue }: { onContinue: () => void }) {
  // Chosen once per mount via the lazy initialiser — re-renders must not
  // reshuffle the artwork mid-splash.
  const [variant] = useState(pickSplashVariant);
  const variantOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // The base layer below is pixel-identical to the native splash, so the
    // handoff is seamless; then the day's variant fades in over it.
    NativeSplash.hideAsync();
    Animated.timing(variantOpacity, {
      toValue: 1,
      duration: 420,
      delay: 220,
      useNativeDriver: true,
    }).start();
  }, [variantOpacity]);

  return (
    <View style={styles.root}>
      <StatusBar style={variant.statusBar} backgroundColor={variant.background} />

      {/* Base: the native splash frame, continued. */}
      <View style={[StyleSheet.absoluteFillObject, styles.center, { backgroundColor: "#FF7700" }]}>
        <SplashMark variant={SPLASH_VARIANTS[0]} />
      </View>

      {/* The randomly chosen treatment fades in over it. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.center,
          { backgroundColor: variant.background, opacity: variantOpacity },
        ]}
      >
        <SplashMark variant={variant} />
      </Animated.View>

      <Pressable
        accessibilityLabel="Continue"
        accessibilityRole="button"
        onPress={onContinue}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FF7700",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  markWrap: {
    alignItems: "center",
    gap: 18,
  },
  nameWrap: {
    alignItems: "center",
  },
  nameRow: {
    alignItems: "center",
    gap: 2,
  },
  nameText: {
    fontFamily: "ClashDisplay_700Bold",
    fontSize: 30,
    letterSpacing: 0.5,
  },
  driverTag: {
    fontFamily: "ClashDisplay_500Medium",
    fontSize: 13,
    letterSpacing: 6,
  },
});
