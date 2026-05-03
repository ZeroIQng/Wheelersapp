import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { MapMock } from "@/components/MapMock";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { TripProgressBar } from "@/components/TripProgressBar";
import {
  estimateRide,
  getAdditionalStopCount,
  getRideRouteRows,
  parseRideItineraryParam,
  serializeRideItinerary,
} from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

function formatUsdt(value: number | undefined, fallback: string): string {
  return typeof value === "number" ? `${value.toFixed(2)} USDT` : fallback;
}

export default function RiderActiveTripScreen() {
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
  const routeRows = useMemo(() => getRideRouteRows(itinerary), [itinerary]);
  const extraStops = getAdditionalStopCount(itinerary);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const nextStop =
    currentRide?.driverLocation?.nextStopAddress ??
    routeRows[1]?.value ??
    itinerary.stops[0];
  const statusLabel =
    currentRide?.status === "active"
      ? "TRIP IN PROGRESS"
      : currentRide?.status === "completed"
        ? "TRIP COMPLETED"
        : currentRide?.status === "matched"
          ? "DRIVER EN ROUTE"
          : currentRide?.status === "matching"
            ? "MATCHING DRIVER"
            : "TRIP UPDATE";
  const statusText =
    currentRide?.status === "active"
      ? "Live trip in progress"
      : currentRide?.status === "completed"
        ? "Ride completed"
        : currentRide?.status === "matched"
          ? "Driver heading to your pickup"
          : currentRide?.status === "matching"
            ? "Waiting for a driver to accept"
            : "Trip status unavailable";
  const metrics = [
    {
      id: "eta",
      label: currentRide?.status === "completed" ? "MIN TRIP" : "MIN LEFT",
      value: String(
        currentRide?.driver?.etaSeconds
          ? Math.max(1, Math.ceil(currentRide.driver.etaSeconds / 60))
          : currentRide?.plannedDurationSeconds
            ? Math.max(1, Math.ceil(currentRide.plannedDurationSeconds / 60))
            : estimate.etaMinutes + 9,
      ),
      accent: "orange" as const,
    },
    {
      id: "distance",
      label: currentRide?.status === "completed" ? "KM TRIP" : "KM LEFT",
      value: (
        currentRide?.driverLocation?.distanceToNextStopKm ??
        currentRide?.plannedDistanceKm ??
        estimate.distanceKm
      ).toFixed(1),
    },
    {
      id: "fare",
      label: currentRide?.status === "completed" ? "FARE PAID" : "FARE",
      value: formatUsdt(
        currentRide?.completedFareUsdt ??
          currentRide?.driver?.lockedFareUsdt ??
          currentRide?.fareEstimateUsdt,
        estimate.priceLabel,
      ),
    },
  ];

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
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />
      <View style={styles.mapWrap}>
        <MapMock
          height={260}
          showCar
          showDestination
          showRoute
          topBadge="LIVE"
          variant="riderTrip"
        >
          <BackArrow onPress={() => router.back()} style={styles.backButton} />
        </MapMock>
      </View>

      <View style={styles.content}>
        <View style={styles.statusRow}>
          <StatusPill label={statusLabel} variant="dark" />
          <AppText variant="monoSmall" color={theme.colors.muted}>
            ● {statusText}
          </AppText>
        </View>

        <TripProgressBar
          progress={
            currentRide?.status === "completed"
              ? 1
              : currentRide?.status === "active"
                ? 0.62
                : currentRide?.status === "matched"
                  ? 0.28
                  : 0.14
          }
        />

        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <MetricCard
              accent={metric.accent}
              key={metric.id}
              label={metric.label}
              style={styles.metric}
              value={metric.value}
            />
          ))}
        </View>

        <AppCard style={styles.bannerCard}>
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerCopy}>
              <AppText variant="monoSmall" color={theme.colors.muted}>
                {currentRide?.status === "matched" ? "DRIVER NEXT STOP" : "HEADING TO"}
              </AppText>
              <AppText variant="bodyMedium">{nextStop}</AppText>
            </View>
            <AppButton
              title="Add or change"
              variant="ghost"
              disabled={currentRide?.status === "completed"}
              onPress={() =>
                router.push({
                  pathname: "/destination-search",
                  params: {
                    flowMode: "trip-edit",
                    itinerary: serializedItinerary,
                  },
                })
              }
              style={styles.editButton}
            />
          </View>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {extraStops > 0
              ? `${extraStops} extra stop${extraStops === 1 ? "" : "s"} still in this trip.`
              : "No extra stops added to this trip."}
          </AppText>
        </AppCard>

        <AppCard style={styles.routeCard}>
          {routeRows.map((row) => (
            <StopRow key={row.id} kind={row.kind} label={row.value} />
          ))}
        </AppCard>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push("/safety/emergency")}
            style={styles.sosButton}
          >
            <AppText variant="label" color={theme.colors.offWhite}>
              SOS
            </AppText>
          </Pressable>
          <AppButton
            title="Share trip ↗"
            variant="ghost"
            style={styles.shareButton}
          />
        </View>

        <AppButton
          title={
            currentRide?.status === "completed"
              ? "Rate trip ↗"
              : currentRide?.status === "active"
                ? "Waiting for completion"
                : "Driver en route"
          }
          disabled={currentRide?.status !== "completed"}
          onPress={() => router.push("/rider/trip-rating")}
        />

        {currentRide?.status !== "completed" ? (
          <AppButton
            title="Cancel ride"
            variant="danger"
            onPress={handleCancelRide}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

function StopRow({
  kind,
  label,
}: {
  kind: "pickup" | "stop" | "destination";
  label: string;
}) {
  return (
    <View style={styles.stopRow}>
      <View
        style={[
          styles.stopDot,
          kind === "pickup"
            ? styles.stopDotPickup
            : kind === "destination"
              ? styles.stopDotDestination
              : styles.stopDotStop,
        ]}
      />
      <AppText variant="bodyMedium">{label}</AppText>
    </View>
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
  backButton: {
    position: "absolute",
    top: 12,
    left: theme.spacing.gutter,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  metric: {
    minHeight: 86,
  },
  bannerCard: {
    gap: theme.spacing.sm,
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  bannerCopy: {
    flex: 1,
    gap: 2,
  },
  editButton: {
    width: 140,
  },
  routeCard: {
    gap: theme.spacing.sm,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  stopDotPickup: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.green,
  },
  stopDotStop: {
    borderRadius: 3,
    backgroundColor: "#FFD1B5",
  },
  stopDotDestination: {
    borderRadius: 3,
    backgroundColor: theme.colors.orange,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  sosButton: {
    width: 78,
    minHeight: 52,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  shareButton: {
    flex: 1,
  },
});
