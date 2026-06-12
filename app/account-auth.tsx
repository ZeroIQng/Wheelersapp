import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { RingStack, StarBurst } from "@/components/decorative-shapes";
import { FlowHeader } from "@/components/flow-header";
import { FloatingView, RevealView } from "@/components/motion";
import { storeLocalAccessToken } from "@/lib/access-token";
import {
  isBackendConfigured,
  signinWithUsernamePassword,
  signupWithUsernamePassword,
} from "@/lib/api";
import { getAuthenticatedRoute, persistAuthenticatedRole } from "@/lib/auth-state";
import { getDisplayErrorMessage } from "@/lib/errors";
import { theme } from "@/theme";

type AuthMode = "signup" | "signin";

function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "_");
}

export default function AccountAuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateCredentials() {
    const normalizedUsername = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      throw new Error("Enter 3-24 letters or numbers. Spaces are okay.");
    }

    if (password.length < 8 || password.length > 128) {
      throw new Error("Password must be between 8 and 128 characters.");
    }

    return { username: normalizedUsername, password };
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    if (!isBackendConfigured()) {
      Alert.alert("Backend not configured", "Set EXPO_PUBLIC_API_BASE_URL before continuing.");
      return;
    }

    let credentials: { username: string; password: string };
    try {
      credentials = validateCredentials();
    } catch (error) {
      Alert.alert(
        "Check your details",
        error instanceof Error ? error.message : "Enter your username and password.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        mode === "signup"
          ? await signupWithUsernamePassword({
              ...credentials,
              role: "RIDER",
            })
          : await signinWithUsernamePassword(credentials);

      await storeLocalAccessToken(response.accessToken);

      const nextState = await persistAuthenticatedRole("RIDER", {
        phoneVerified:
          typeof response.user.phone === "string" &&
          response.user.phone.length > 0,
      });

      router.replace(getAuthenticatedRoute(nextState));
    } catch (error) {
      const fallback =
        mode === "signup" ? "Could not create your account." : "Could not sign in.";
      Alert.alert(
        mode === "signup" ? "Signup failed" : "Signin failed",
        getDisplayErrorMessage(error, fallback) ?? fallback,
      );
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
    return (
      <AppScreen
        backgroundColor={theme.colors.offWhite}
        contentStyle={styles.loadingContainer}
      >
        <FloatingView style={styles.loadingRings} distance={10} rotate={8}>
          <RingStack color="rgba(255,92,0,0.12)" />
        </FloatingView>
        <RevealView delay={40} style={styles.loadingCard}>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator color={theme.colors.orange} size="large" />
          </View>
          <View style={styles.loadingCopy}>
            <AppText variant="h3" style={styles.loadingTitle}>
              {mode === "signup" ? "Creating your account" : "Signing you in"}
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted} style={styles.loadingText}>
              Taking you to phone verification...
            </AppText>
          </View>
        </RevealView>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll
      contentStyle={styles.container}
    >
      <FloatingView style={styles.rings} distance={10} rotate={8}>
        <RingStack color="rgba(255,92,0,0.12)" />
      </FloatingView>
      <FloatingView style={styles.star} delay={200} distance={12} rotate={-12}>
        <StarBurst color="rgba(13,13,13,0.08)" width={46} height={46} />
      </FloatingView>

      <RevealView delay={40} from="down" style={styles.headerWrap}>
        <FlowHeader
          showBack
          backHref="/role-selection"
          overline="WHEELERS ACCOUNT"
          title={mode === "signup" ? "Create your\naccount" : "Welcome\nback"}
          subtitle="Use a username and password, then verify your WhatsApp number."
          progress={{ count: 5, active: 2 }}
        />
      </RevealView>

      <RevealView delay={130}>
        <AppCard style={styles.authCard}>
          <View style={styles.authTabs}>
            <Pressable
              onPress={() => setMode("signup")}
              style={[styles.authTab, mode === "signup" ? styles.authTabActive : null]}
            >
              <AppText
                variant="monoSmall"
                color={mode === "signup" ? theme.colors.white : theme.colors.black}
              >
                SIGN UP
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setMode("signin")}
              style={[styles.authTab, mode === "signin" ? styles.authTabActive : null]}
            >
              <AppText
                variant="monoSmall"
                color={mode === "signin" ? theme.colors.white : theme.colors.black}
              >
                SIGN IN
              </AppText>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              NAME OR USERNAME
            </AppText>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setUsername}
              placeholder="Timilehin Olowu"
              placeholderTextColor={theme.colors.mutedLight}
              selectionColor={theme.colors.orange}
              style={styles.textInput}
              value={username}
            />
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              PASSWORD
            </AppText>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor={theme.colors.mutedLight}
              secureTextEntry
              selectionColor={theme.colors.orange}
              style={styles.textInput}
              value={password}
            />
          </View>

          <AppButton
            title={
              isSubmitting
                ? mode === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "signup"
                  ? "Continue"
                  : "Sign in"
            }
            disabled={isSubmitting}
            onPress={() => {
              void handleSubmit();
            }}
          />
        </AppCard>
      </RevealView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xl, paddingTop: theme.spacing.lg },
  headerWrap: { marginTop: theme.spacing.sm },
  rings: { position: "absolute", top: -20, right: -32 },
  star: { position: "absolute", bottom: 42, left: 16 },
  authCard: { gap: theme.spacing.md },
  authTabs: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  authTab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
  },
  authTabActive: {
    backgroundColor: theme.colors.black,
  },
  fieldGroup: {
    gap: theme.spacing.xs,
  },
  textInput: {
    minHeight: 52,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.black,
    ...theme.typography.body,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    paddingTop: theme.spacing.xl,
  },
  loadingRings: {
    position: "absolute",
    top: 48,
    right: -24,
  },
  loadingCard: {
    alignItems: "center",
    gap: theme.spacing.lg,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    ...theme.shadows.card,
  },
  spinnerWrap: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: 34,
    backgroundColor: theme.colors.orangeLight,
  },
  loadingCopy: {
    gap: theme.spacing.xs,
    alignItems: "center",
  },
  loadingTitle: {
    textAlign: "center",
  },
  loadingText: {
    textAlign: "center",
  },
});
