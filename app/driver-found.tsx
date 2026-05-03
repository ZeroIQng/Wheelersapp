import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { BackArrow } from "@/components/back-arrow";
import { AppBadge } from "@/components/app-badge";
import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FloatingView, PulseView, RevealView } from "@/components/motion";
import { StaticMap } from "@/components/static-map";
import { driver } from "@/data/mock";
import {
  estimateRide,
  getAdditionalStopCount,
  parseRideItineraryParam,
  serializeRideItinerary,
} from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

function formatUsdt(value: number | undefined, fallback: string): string {
  return typeof value === "number" ? `${value.toFixed(2)} USDT` : fallback;
}

export default function DriverFoundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
  }>();
  const fallbackItinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const { cancelRide, currentRide } = useRideSession();
  const itinerary = currentRide?.itinerary ?? fallbackItinerary;
  const estimate = useMemo(() => estimateRide(itinerary), [itinerary]);
  const extraStops = getAdditionalStopCount(itinerary);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const liveDriver = currentRide?.driver;
  const etaMinutes = liveDriver?.etaSeconds
    ? Math.max(1, Math.ceil(liveDriver.etaSeconds / 60))
    : driver.etaMinutes;
  const fareLabel = formatUsdt(
    liveDriver?.lockedFareUsdt ?? currentRide?.fareEstimateUsdt,
    driver.fare,
  );

  useEffect(() => {
    if (currentRide?.status === "active") {
      router.replace({
        pathname: "/rider/active-trip",
        params: { itinerary: serializedItinerary },
      });
    }
  }, [currentRide?.status, router, serializedItinerary]);

  async function handleCancelRide() {
    try {
      await cancelRide("rider_cancelled");
    } finally {
      router.replace("/rider");
    }
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <RevealView style={styles.mapWrap}>
        <StaticMap height={232} scene="driverFound">
          <FloatingView style={styles.backButton} distance={5}>
            <BackArrow onPress={() => router.back()} />
          </FloatingView>
          <FloatingView style={styles.etaChip} distance={6}>
            <AppText variant="monoSmall">ETA: {etaMinutes} min</AppText>
          </FloatingView>
        </StaticMap>
      </RevealView>

      <RevealView delay={120} style={styles.content}>
        <View style={styles.headerRow}>
          <AppBadge
            label={currentRide?.status === "active" ? "TRIP STARTED" : "DRIVER MATCHED"}
          />
          <AppText variant="monoSmall" color={theme.colors.green}>
            ● {currentRide?.status === "active" ? "LIVE" : "CONFIRMED"}
          </AppText>
        </View>

        <View style={styles.driverRow}>
          <PulseView>
            <View style={styles.avatar}>
              <AppText variant="h3" color={theme.colors.white}>
                {(liveDriver?.driverName ?? driver.name)
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AppText>
            </View>
          </PulseView>
          <View style={styles.driverText}>
            <AppText variant="h3">{liveDriver?.driverName ?? driver.name}</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              ⭐ {liveDriver?.driverRating?.toFixed(1) ?? driver.rating} · {" "}
              {liveDriver?.vehicleModel ?? driver.vehicle}
            </AppText>
            <View style={styles.plate}>
              <AppText variant="monoSmall" color={theme.colors.offWhite}>
                {liveDriver?.vehiclePlate ?? driver.plate}
              </AppText>
            </View>
          </View>
          <AppText style={styles.chat}>💬</AppText>
        </View>

        <AppCard style={styles.routeSummaryCard}>
          <AppText variant="monoSmall" color={theme.colors.muted}>
            ROUTE CONFIRMED
          </AppText>
          <AppText variant="bodyMedium">{itinerary.stops[0]}</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {extraStops > 0
              ? `${extraStops} extra stop${extraStops === 1 ? "" : "s"} added before final drop-off.`
              : "Direct trip with no extra stops."}
          </AppText>
        </AppCard>

        <View style={styles.statsRow}>
          <RevealView delay={180} style={styles.statSlot}>
            <StatCard value={`${etaMinutes}`} label="MIN AWAY" accent />
          </RevealView>
          <RevealView delay={240} style={styles.statSlot}>
            <StatCard value={fareLabel} label="LIVE FARE" />
          </RevealView>
          <RevealView delay={300} style={styles.statSlot}>
            <StatCard
              value={`${currentRide?.plannedDurationSeconds ? Math.max(1, Math.ceil(currentRide.plannedDurationSeconds / 60)) : estimate.etaMinutes + 12}`}
              label="MIN TRIP"
            />
          </RevealView>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Track trip ↗"
            onPress={() =>
              router.push({
                pathname: "/rider/active-trip",
                params: { itinerary: serializedItinerary },
              })
            }
            style={styles.primaryAction}
          />
          <View style={styles.secondaryActions}>
            <AppButton
              title="Call"
              variant="ghost"
              style={styles.secondaryButton}
            />
            <AppButton
              title="Cancel"
              variant="danger"
              onPress={handleCancelRide}
              style={styles.secondaryButton}
            />
          </View>
        </View>
      </RevealView>
    </AppScreen>
  );
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <AppCard style={styles.statCard}>
      <AppText
        variant="monoLarge"
        color={accent ? theme.colors.orange : theme.colors.black}
      >
        {value}
      </AppText>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {label}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.xl,
  },
  mapWrap: {
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
  },
  etaChip: {
    position: "absolute",
    top: 12,
    left: 66,
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    ...theme.shadows.card,
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: theme.spacing.gutter,
    zIndex: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: theme.borders.regular,
    borderBottomColor: "#EEE0D4",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  driverText: {
    flex: 1,
    gap: 3,
  },
  plate: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    ...theme.shadows.subtle,
  },
  chat: {
    fontSize: 22,
  },
  routeSummaryCard: {
    gap: theme.spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  statSlot: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: theme.spacing.sm,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  primaryAction: {
    width: "100%",
  },
  secondaryActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
  },
});
