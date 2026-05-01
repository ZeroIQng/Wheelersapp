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
import { theme } from "@/theme";

export default function RiderActiveTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
  }>();
  const itinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const estimate = useMemo(() => estimateRide(itinerary), [itinerary]);
  const routeRows = useMemo(() => getRideRouteRows(itinerary), [itinerary]);
  const extraStops = getAdditionalStopCount(itinerary);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const nextStop = routeRows[1]?.value ?? itinerary.stops[0];
  const statusText =
    extraStops > 0
      ? `Heading to stop 1 of ${itinerary.stops.length}`
      : "On route";
  const metrics = [
    {
      id: "eta",
      label: "MIN LEFT",
      value: String(estimate.etaMinutes + 9),
      accent: "orange" as const,
    },
    {
      id: "distance",
      label: "KM LEFT",
      value: estimate.distanceKm.toFixed(1),
    },
    {
      id: "fare",
      label: "FARE",
      value: estimate.priceLabel,
    },
  ];

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
          <StatusPill label="TRIP IN PROGRESS" variant="dark" />
          <AppText variant="monoSmall" color={theme.colors.muted}>
            ● {statusText}
          </AppText>
        </View>

        <TripProgressBar progress={0.45} />

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
                HEADING TO
              </AppText>
              <AppText variant="bodyMedium">{nextStop}</AppText>
            </View>
            <AppButton
              title="Add or change"
              variant="ghost"
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
          title="Arrived at destination ↗"
          onPress={() => router.push("/rider/trip-rating")}
        />
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
    gap: theme.spacing.sm,
  },
  sosButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: "#FF3333",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  shareButton: {
    flex: 2,
  },
});
