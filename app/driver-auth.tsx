import { useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { theme } from "@/theme";

export default function DriverAuthScreen() {
  const router = useRouter();

  async function handleAppleSignIn() {
    // TODO: Phase 1 — Apple authentication via expo-apple-authentication
    // For now, navigate forward for layout testing
    router.replace("/driver/onboarding/welcome");
  }

  async function handleGoogleSignIn() {
    // TODO: Phase 1 — Google authentication via @react-native-google-signin
    // For now, navigate forward for layout testing
    router.replace("/driver/onboarding/welcome");
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
          <AppButton
            title="Continue with Apple"
            onPress={handleAppleSignIn}
            variant="primary"
            style={styles.appleButton}
          />
        )}

        <AppButton
          title="Continue with Google"
          onPress={handleGoogleSignIn}
          variant="inverse"
        />
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
  appleButton: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
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
