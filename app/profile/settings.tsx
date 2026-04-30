import { usePrivy } from "@privy-io/expo";
import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { SettingsRow } from "@/components/SettingsRow";
import { SettingOption, settingsOptions, userProfile } from "@/data/mock";
import { clearStoredAuthState } from "@/lib/auth-state";
import { isPrivyConfigured } from "@/lib/privy";
import { getPrivyEmail, getPrivyName } from "@/lib/privy-user";
import { theme } from "@/theme";

const accountSettingIds = new Set([
  "edit-profile",
  "notifications",
  "security",
]);
const accountActionIds = new Set(["logout"]);

const supportOptions = [
  {
    id: "help-center",
    icon: "🛟",
    title: "Help Center",
    subtitle: "Browse answers for rides, billing, and account issues.",
    type: "navigation",
    route: "/support/help-center",
  },
  {
    id: "customer-support",
    icon: "💬",
    title: "Customer Support",
    subtitle: "Start a live chat with the Wheelers support team.",
    type: "navigation",
    route: "/support/chat",
  },
] satisfies SettingOption[];

type SettingsProfile = {
  initials: string;
  name: string;
  email: string;
  verificationState: string;
};

function titleCaseSegment(value: string): string {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function deriveNameFromEmail(email: string): string {
  const [localPart] = email.split("@");
  const normalized = localPart
    .replace(/[._-]+/g, " ")
    .trim();

  if (!normalized) {
    return "Wheelers User";
  }

  return normalized
    .split(/\s+/)
    .filter((segment) => segment.length > 0)
    .map(titleCaseSegment)
    .join(" ");
}

function deriveInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

  if (letters.length >= 2) {
    return letters;
  }

  const compact = name.replace(/\s+/g, "").slice(0, 2).toUpperCase();
  return compact || userProfile.initials;
}

function buildProfile(input?: { name?: string; email?: string }): SettingsProfile {
  const email = input?.email?.trim() || userProfile.email;
  const name = input?.name?.trim() || deriveNameFromEmail(email);

  return {
    initials: deriveInitials(name),
    name,
    email,
    verificationState: "Verified account",
  };
}

export default function SettingsScreen() {
  if (!isPrivyConfigured) {
    return <LocalSettingsScreen />;
  }

  return <PrivySettingsScreen />;
}

function LocalSettingsScreen() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await clearStoredAuthState();
      router.replace("/role-selection");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <SettingsScreenBody
      isLoggingOut={isLoggingOut}
      onLogout={handleLogout}
      profile={buildProfile()}
    />
  );
}

function PrivySettingsScreen() {
  const router = useRouter();
  const { logout, user } = usePrivy();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logout();
      await clearStoredAuthState();
      router.replace("/role-selection");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <SettingsScreenBody
      isLoggingOut={isLoggingOut}
      onLogout={handleLogout}
      profile={buildProfile({
        name: user ? getPrivyName(user) : undefined,
        email: user ? getPrivyEmail(user) : undefined,
      })}
    />
  );
}

function SettingsScreenBody({
  isLoggingOut,
  onLogout,
  profile,
}: {
  isLoggingOut: boolean;
  onLogout: () => Promise<void>;
  profile: SettingsProfile;
}) {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const accountSettings = settingsOptions.filter((item) =>
    accountSettingIds.has(item.id),
  );
  const accountActions = settingsOptions.filter((item) =>
    accountActionIds.has(item.id),
  );

  async function handleRowPress(id: string, route?: string) {
    if (route) {
      router.push(route as Href);
      return;
    }
    if (id === "edit-profile") {
      Alert.alert(
        "Edit profile",
        "Profile editing will appear here in a later pass.",
      );
      return;
    }
    if (id === "security") {
      Alert.alert(
        "Security & PIN",
        "Security tools and PIN controls will appear here in a later pass.",
      );
      return;
    }
    if (id === "logout") {
      if (isLoggingOut) {
        return;
      }

      try {
        await onLogout();
      } catch (error) {
        Alert.alert(
          "Logout failed",
          error instanceof Error ? error.message : "Could not log you out.",
        );
      }
    }
  }

  function renderRows(items: SettingOption[], options?: { support?: boolean }) {
    return items.map((item, index) => (
      <SettingsRow
        destructive={item.type === "danger"}
        highlight={Boolean(options?.support && item.id === "customer-support")}
        icon={item.icon}
        key={item.id}
        onPress={
          item.type === "navigation" || item.type === "danger"
            ? () => void handleRowPress(item.id, item.route)
            : undefined
        }
        onToggle={
          item.type === "toggle"
            ? () => setNotificationsEnabled((current) => !current)
            : undefined
        }
        showDivider={index < items.length - 1}
        subtitle={item.subtitle}
        title={item.id === "logout" && isLoggingOut ? "Logging out..." : item.title}
        toggleValue={item.type === "toggle" ? notificationsEnabled : undefined}
        value={item.type === "value" ? item.value : undefined}
      />
    ));
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="screenTitle">Settings</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Manage your account, app preferences, and support.
          </AppText>
        </View>

        <AppCard style={styles.settingsCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <AppText variant="h3" color={theme.colors.white}>
                {profile.initials}
              </AppText>
            </View>
            <View style={styles.profileCopy}>
              <AppText variant="bodyMedium">{profile.name}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {profile.email}
              </AppText>
              <AppText variant="caption" color={theme.colors.orange}>
                {profile.verificationState}
              </AppText>
            </View>
          </View>

          <View style={styles.fullDivider} />

          <View style={styles.sectionLabel}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              ACCOUNT
            </AppText>
          </View>
          {renderRows(accountSettings)}

          <View style={styles.fullDivider} />

          <View style={styles.sectionLabel}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              SUPPORT
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Need help with a ride, payment, or your account?
            </AppText>
          </View>
          {renderRows(supportOptions, { support: true })}

          <View style={styles.fullDivider} />

          <View style={styles.sectionLabel}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              ACCOUNT ACTIONS
            </AppText>
          </View>
          {renderRows(accountActions)}
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  content: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    gap: theme.spacing.xxs,
  },
  settingsCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.subtle,
  },
  profileCopy: {
    flex: 1,
    gap: 3,
  },
  sectionLabel: {
    gap: 2,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxs,
  },
  fullDivider: {
    height: 1,
    backgroundColor: "#E8E4DE",
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xxs,
    marginBottom: 0,
  },
});
