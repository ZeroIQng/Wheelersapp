import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, StyleSheet, View, ActivityIndicator } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { theme } from "@/theme";
import { signInWithApple, signInWithGoogle } from "@/lib/api";
import { storeLocalAccessToken } from "@/lib/access-token";
import { persistAuthenticatedRole } from "@/lib/auth-state";

const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  Constants.expoConfig?.extra?.googleClientId ??
  "";

GoogleSignin.configure({
  iosClientId: GOOGLE_CLIENT_ID,
  webClientId: GOOGLE_CLIENT_ID,
});

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z" fill="#FBBC05" />
      <Path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.16 6.16-4.16z" fill="#EA4335" />
    </Svg>
  );
}

export default function DriverAuthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAppleSignIn() {
    try {
      setLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert("Error", "Apple did not return an identity token.");
        return;
      }

      const name =
        credential.fullName?.givenName || credential.fullName?.familyName
          ? [credential.fullName.givenName, credential.fullName.familyName]
              .filter(Boolean)
              .join(" ")
          : undefined;

      const result = await signInWithApple({
        idToken: credential.identityToken,
        name,
      });

      await storeLocalAccessToken(result.accessToken);
      await persistAuthenticatedRole("DRIVER");
      router.replace("/driver/onboarding/welcome");
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }

      Alert.alert(
        "Sign in failed",
        error instanceof Error ? error.message : "Could not sign in with Apple.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setLoading(true);

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) {
        Alert.alert("Error", "Google did not return an ID token.");
        return;
      }

      const result = await signInWithGoogle({ idToken });

      await storeLocalAccessToken(result.accessToken);
      await persistAuthenticatedRole("DRIVER");
      router.replace("/driver/onboarding/welcome");
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "SIGN_IN_CANCELLED"
      ) {
        return;
      }

      Alert.alert(
        "Sign in failed",
        error instanceof Error ? error.message : "Could not sign in with Google.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen contentStyle={styles.container}>
      {/* Logo + branding */}
      <View style={styles.top}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <AppText variant="h1" color={theme.colors.white} style={styles.logoText}>
              W
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <AppText variant="h1" style={styles.title}>
            WHEELERS DRIVER
          </AppText>
          <AppText variant="body" color={theme.colors.muted} style={styles.tagline}>
            Earn on your schedule
          </AppText>
        </Animated.View>
      </View>

      {/* Auth buttons */}
      <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.buttons}>
        {Platform.OS === "ios" && (
          <Pressable
            accessibilityRole="button"
            onPress={handleAppleSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.platformButton,
              styles.appleButton,
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={22} color={theme.colors.white} />
                <AppText variant="label" color={theme.colors.white}>
                  Continue with Apple
                </AppText>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={handleGoogleSignIn}
          disabled={loading}
          style={({ pressed }) => [
            styles.platformButton,
            styles.googleButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.black} />
          ) : (
            <>
              <GoogleIcon size={20} />
              <AppText variant="label" color={theme.colors.black}>
                Continue with Google
              </AppText>
            </>
          )}
        </Pressable>
      </Animated.View>

      {/* Terms */}
      <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.footer}>
        <AppText variant="bodySmall" color={theme.colors.muted} style={styles.terms}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </AppText>
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
    paddingTop: 80,
  },
  top: {
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  logoWrap: {
    marginBottom: theme.spacing.sm,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  logoText: {
    fontSize: 28,
    lineHeight: 30,
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.5,
  },
  tagline: {
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  buttons: {
    gap: theme.spacing.md,
    width: "100%",
  },
  platformButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    minHeight: 52,
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.sm,
    width: "100%",
    ...theme.shadows.card,
  },
  appleButton: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  googleButton: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.black,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: "center",
    paddingBottom: theme.spacing.lg,
  },
  terms: {
    textAlign: "center",
    maxWidth: 260,
  },
});
