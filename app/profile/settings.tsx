import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { SettingsRow } from "@/components/SettingsRow";
import { SettingOption, settingsOptions, userProfile } from "@/data/mock";
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

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const accountSettings = settingsOptions.filter((item) =>
    accountSettingIds.has(item.id),
  );
  const accountActions = settingsOptions.filter((item) =>
    accountActionIds.has(item.id),
  );

  function handleRowPress(id: string, route?: string) {
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
      router.replace("/role-selection");
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
            ? () => handleRowPress(item.id, item.route)
            : undefined
        }
        onToggle={
          item.type === "toggle"
            ? () => setNotificationsEnabled((c) => !c)
            : undefined
        }
        showDivider={index < items.length - 1}
        subtitle={item.subtitle}
        title={item.title}
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
          {/* Profile row */}
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <AppText variant="h3" color={theme.colors.white}>
                {userProfile.initials}
              </AppText>
            </View>
            <View style={styles.profileCopy}>
              <AppText variant="bodyMedium">{userProfile.name}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {userProfile.email}
              </AppText>
              <AppText variant="caption" color={theme.colors.orange}>
                {userProfile.verificationState}
              </AppText>
            </View>
          </View>

          {/* Full-bleed divider after profile */}
          <View style={styles.fullDivider} />

          {/* Account section */}
          <View style={styles.sectionLabel}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              ACCOUNT
            </AppText>
          </View>
          {renderRows(accountSettings)}

          {/* Full-bleed divider between sections */}
          <View style={styles.fullDivider} />

          {/* Support section */}
          <View style={styles.sectionLabel}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              SUPPORT
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Need help with a ride, payment, or your account?
            </AppText>
          </View>
          {renderRows(supportOptions, { support: true })}

          {/* Full-bleed divider before actions */}
          <View style={styles.fullDivider} />

          {/* Account actions section */}
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
    paddingTop: theme.spacing.md, // ← was lg
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

  // Section label pill — tinted background so it reads as a header, not a row
  sectionLabel: {
    gap: 2,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm, // ← was md
    paddingBottom: theme.spacing.xxs, // ← was xs, pull label closer to first row
  },
  // Thick full-width divider that visually "cuts" between sections
  fullDivider: {
    height: 1,
    backgroundColor: "#E8E4DE",
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xxs, // ← tighter top margin
    marginBottom: 0, // ← no bottom margin, label provides the gap
  },
});
