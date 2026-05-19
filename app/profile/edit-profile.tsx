import { usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { getCurrentProfile, isBackendConfigured, updateCurrentProfile } from "@/lib/api";
import { getPrivyEmail, getPrivyName } from "@/lib/privy-user";
import { theme } from "@/theme";

function normalizeUsernameInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = usePrivy();
  const fallbackEmail = user ? getPrivyEmail(user) ?? "Not available" : "Not available";
  const fallbackName = user ? getPrivyName(user) ?? "" : "";
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(fallbackEmail);
  const [phone, setPhone] = useState("Not added");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setEmail(fallbackEmail);
    setFullName((current) => current || fallbackName);
  }, [fallbackEmail, fallbackName, user]);

  useEffect(() => {
    if (!isReady || !isBackendConfigured()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        return;
      }

      try {
        const response = await getCurrentProfile({ accessToken });
        if (cancelled) {
          return;
        }

        setUsername(response.user.username ?? "");
        setFullName(response.user.name ?? fallbackName);
        setEmail(response.user.email ?? fallbackEmail);
        setPhone(response.user.phone ?? "Not added");
      } catch {
        // keep local fallback values
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackEmail, fallbackName, getAccessToken, isReady, user]);

  const handleSave = async () => {
    if (!isBackendConfigured()) {
      Alert.alert("Backend unavailable", "Profile update is unavailable right now.");
      return;
    }

    if (!isReady) {
      Alert.alert("Account loading", "Wait a moment, then try again.");
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedFullName = fullName.trim();

    if (!trimmedUsername) {
      Alert.alert("Username required", "Enter a username to continue.");
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(trimmedUsername)) {
      Alert.alert(
        "Invalid username",
        "Username must be 3-24 characters and use only lowercase letters, numbers, or underscores.",
      );
      return;
    }

    if (!trimmedFullName || trimmedFullName.length < 2) {
      Alert.alert("Full name required", "Enter your full name to continue.");
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      Alert.alert("Authentication required", "Could not verify your session right now.");
      return;
    }

    setIsSaving(true);

    try {
      await updateCurrentProfile({
        accessToken,
        username: trimmedUsername,
        fullName: trimmedFullName,
      });
      router.back();
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Could not update your profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.header}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle">Edit Profile</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Update the name details riders and support will see.
          </AppText>
        </View>
      </View>

      <AppCard style={styles.card}>
        <View style={styles.fieldGroup}>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Username
          </AppText>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => setUsername(normalizeUsernameInput(value))}
            placeholder="timilehin_ride"
            placeholderTextColor="#B5ACA4"
            style={styles.input}
            value={username}
          />
        </View>

        <View style={styles.fieldGroup}>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Full name
          </AppText>
          <TextInput
            onChangeText={setFullName}
            placeholder="Timilehin Olowu"
            placeholderTextColor="#B5ACA4"
            style={styles.input}
            value={fullName}
          />
        </View>

        <View style={styles.readOnlyCard}>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Email
          </AppText>
          <AppText variant="bodyMedium">{email}</AppText>
        </View>

        <View style={styles.readOnlyCard}>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Phone number
          </AppText>
          <AppText variant="bodyMedium">{phone}</AppText>
        </View>

        <AppButton
          disabled={isSaving}
          onPress={handleSave}
          title="Save changes"
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  card: {
    gap: theme.spacing.md,
  },
  fieldGroup: {
    gap: theme.spacing.xs,
  },
  input: {
    minHeight: 54,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    ...theme.typography.bodyMedium,
  },
  readOnlyCard: {
    gap: theme.spacing.xxs,
    borderWidth: theme.borders.regular,
    borderColor: "#E8E4DE",
    borderRadius: theme.radii.md,
    backgroundColor: "#F7F3EE",
    padding: theme.spacing.md,
  },
});
