import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function EmptyRideState({
  title,
  subtitle,
  icon,
  accentColor,
  ctaLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyArtwork}>
        <View
          style={[
            styles.emptyHalo,
            {
              backgroundColor:
                accentColor === theme.colors.orange ? "#FFF1E8" : "#FFF8D8",
            },
          ]}
        />
        <View style={styles.emptyArtworkMain}>
          <MaterialIcons color={theme.colors.black} name={icon} size={34} />
        </View>
      </View>

      <View style={styles.emptyCopy}>
        <AppText variant="h2" style={styles.emptyTitle}>
          {title}
        </AppText>
        <AppText variant="bodyMedium" color={theme.colors.muted}>
          {subtitle}
        </AppText>
      </View>

      <View style={styles.emptyFooter}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {ctaLabel}
        </AppText>
        <Pressable onPress={onPress} style={styles.emptyFab}>
          <MaterialIcons color={theme.colors.offWhite} name="add" size={24} />
        </Pressable>
      </View>
    </View>
  );
}

export default function RiderHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[]; toast?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const handledToastRef = useRef<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { items: rides, isLoading, error } = useRiderHistory(30);
  const {
    items: scheduledRides,
    isLoading: isLoadingScheduled,
    error: scheduledError,
    cancelItem,
    refresh: refreshScheduledRides,
  } = useScheduledRides(30);
  const requestedTab =
    (Array.isArray(params.tab) ? params.tab[0] : params.tab) === "scheduled"
      ? "scheduled"
      : "history";
  const requestedToast = Array.isArray(params.toast) ? params.toast[0] : params.toast;
  const [activeTab, setActiveTab] = useState<(typeof rideTabs)[number]["id"]>(
    requestedTab
  );
  const visibleRides = activeTab === "history" ? rides : scheduledRides;

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    if (requestedTab !== "scheduled") {
      return;
    }

    void refreshScheduledRides();
  }, [refreshScheduledRides, requestedTab]);

  useEffect(() => {
    if (!requestedToast || handledToastRef.current === requestedToast) {
      return;
    }

    handledToastRef.current = requestedToast;
    toastOpacity.setValue(0);
    setToastMessage(requestedToast);
  }, [requestedToast, toastOpacity]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setToastMessage(null);
        }
      });
    }, 2600);

    return () => clearTimeout(timeout);
  }, [toastMessage, toastOpacity]);

  return (
    <>
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
            <EmptyRideState
              title="No rides yet"
              subtitle="Your completed trips will show up here with fares, timing, and every route you finish."
              icon="directions-car"
              accentColor={theme.colors.orange}
              ctaLabel="Book a ride"
              onPress={() => router.push("/destination-search")}
            />
          ) : null}

          {activeTab === "scheduled" &&
          !isLoadingScheduled &&
          !scheduledError &&
          visibleRides.length === 0 ? (
            <EmptyRideState
              title="No scheduled rides"
              subtitle="Plan airport runs, early pickups, and later trips here so this page never feels empty again."
              icon="calendar-month"
              accentColor="#E8C84A"
              ctaLabel="Schedule a ride"
              onPress={() => router.push("/schedule-ride")}
            />
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

          {visibleRides.length > 0 ? (
            <View style={styles.listFabRow}>
              <Pressable
                onPress={() =>
                  router.push(
                    activeTab === "scheduled"
                      ? "/schedule-ride"
                      : "/destination-search",
                  )
                }
                style={styles.listFab}
              >
                <MaterialIcons
                  color={theme.colors.offWhite}
                  name="add"
                  size={24}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
      </AppScreen>

      {toastMessage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + theme.spacing.sm,
              opacity: toastOpacity,
              transform: [
                {
                  translateY: toastOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialIcons
            color={theme.colors.offWhite}
            name="check-circle"
            size={18}
          />
          <AppText
            variant="bodySmall"
            color={theme.colors.offWhite}
            style={styles.toastText}
          >
            {toastMessage}
          </AppText>
        </Animated.View>
      ) : null}
    </>
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
  emptyCard: {
    gap: theme.spacing.lg,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    minHeight: 280,
    justifyContent: "space-between",
    ...theme.shadows.card,
  },
  emptyArtwork: {
    position: "relative",
    minHeight: 112,
    justifyContent: "center",
  },
  emptyHalo: {
    position: "absolute",
    left: 10,
    top: 10,
    width: 120,
    height: 84,
    borderRadius: 28,
  },
  emptyArtworkMain: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.offWhite,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  emptyCopy: {
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 28,
  },
  emptyFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  emptyFab: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  listFabRow: {
    alignItems: "flex-end",
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  listFab: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
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
  toast: {
    position: "absolute",
    left: theme.layout.screenPadding,
    right: theme.layout.screenPadding,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.green,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  toastText: {
    flex: 1,
  },
});
