import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { SectionHeader } from "@/components/SectionHeader";
import { useRiderHistory } from "@/lib/rider-history";
import { useScheduledRides } from "@/lib/scheduled-rides";
import { theme } from "@/theme";

const rideTabs = [
  { id: "history", label: "History" },
  { id: "scheduled", label: "Scheduled Rides" },
] as const;

export default function RiderHistoryScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const { items: rides, isLoading, error } = useRiderHistory(30);
  const {
    items: scheduledRides,
    isLoading: isLoadingScheduled,
    error: scheduledError,
    cancelItem,
  } = useScheduledRides(30);
  const initialTab =
    (Array.isArray(params.tab) ? params.tab[0] : params.tab) === "scheduled"
      ? "scheduled"
      : "history";
  const [activeTab, setActiveTab] = useState<(typeof rideTabs)[number]["id"]>(
    initialTab
  );
  const visibleRides = activeTab === "history" ? rides : scheduledRides;

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        eyebrow="RIDER ACTIVITY"
        title="Rides"
        subtitle="Your latest rides and completed trips."
        titleVariant="h1"
      />

      <View style={styles.tabRow}>
        {rideTabs.map((tab) => {
          const active = tab.id === activeTab;

          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={styles.tabButton}
            >
              <View style={styles.tabInner}>
                <AppText
                  variant="bodyMedium"
                  color={active ? theme.colors.black : theme.colors.muted}
                  style={[styles.tabText, active ? styles.tabTextActive : null]}
                >
                  {tab.label}
                </AppText>
                <View
                  style={[
                    styles.tabIndicator,
                    active ? styles.tabIndicatorActive : null,
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {activeTab === "history" && isLoading && visibleRides.length === 0 ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Loading ride history...
          </AppText>
        ) : null}

        {activeTab === "history" && error ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {error}
          </AppText>
        ) : null}

        {activeTab === "scheduled" && isLoadingScheduled && visibleRides.length === 0 ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Loading scheduled rides...
          </AppText>
        ) : null}

        {activeTab === "scheduled" && scheduledError ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {scheduledError}
          </AppText>
        ) : null}

        {activeTab === "history" &&
        !isLoading &&
        !error &&
        visibleRides.length === 0 ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            No completed rides yet.
          </AppText>
        ) : null}

        {activeTab === "scheduled" &&
        !isLoadingScheduled &&
        !scheduledError &&
        visibleRides.length === 0 ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            No scheduled rides yet.
          </AppText>
        ) : null}

        {visibleRides.map((ride) => (
          <AppCard key={ride.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons
                name={ride.icon as keyof typeof MaterialIcons.glyphMap}
                size={20}
                color={theme.colors.black}
              />
            </View>
            <View style={styles.copy}>
              <AppText variant="bodyMedium">{ride.title}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {ride.meta}
              </AppText>
            </View>
            <View style={styles.meta}>
              <AppText variant="mono" color={theme.colors.orange}>
                {ride.fare}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {ride.statusLabel}
              </AppText>
              {activeTab === "scheduled" ? (
                <Pressable
                  onPress={() => void cancelItem(ride.id, "rider_cancelled_schedule")}
                >
                  <AppText variant="monoSmall" color={theme.colors.danger}>
                    Cancel
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  tabRow: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.borderLight,
    paddingBottom: theme.spacing.xs,
  },
  tabButton: {
    paddingVertical: theme.spacing.xs,
  },
  tabInner: {
    alignItems: "flex-start",
    gap: 6,
  },
  tabText: {
    textAlign: "left",
  },
  tabTextActive: {
    fontFamily: "ClashDisplay_600Semibold",
  },
  tabIndicator: {
    width: "100%",
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: "transparent",
  },
  tabIndicatorActive: {
    backgroundColor: theme.colors.orange,
  },
  list: {
    gap: theme.spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  meta: {
    alignItems: "flex-end",
    gap: 2,
  },
});
