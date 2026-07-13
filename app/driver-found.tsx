import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { BackArrow } from "@/components/back-arrow";
import { AppBadge } from "@/components/app-badge";
import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { FloatingView, PulseView, RevealView } from "@/components/motion";
import { LiveMap } from "@/components/live-map";
import {
  parseRideItineraryParam,
} from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

function formatRideFare(params: {
  ngn?: number;
}): string | null {
  if (typeof params.ngn === "number" && Number.isFinite(params.ngn)) {
    return `NGN ${Math.round(params.ngn).toLocaleString("en-NG")}`;
  }

  return null;
}

function formatVehicleLine(params: {
  rating?: number;
  vehicleModel?: string;
}): string {
  const rating =
    typeof params.rating === "number" && Number.isFinite(params.rating)
      ? `${params.rating.toFixed(1)} rated`
      : "Rating pending";
  const vehicle = params.vehicleModel ?? "Vehicle pending";

  return `${rating} • ${vehicle}`;
}

export default function DriverFoundScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
  }>();
  const fallbackItinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const { clearRide, currentRide } = useRideSession();
  const itinerary = currentRide?.itinerary ?? fallbackItinerary;
  const liveDriver = currentRide?.driver;
  const etaMinutes = liveDriver?.etaSeconds
    ? Math.max(1, Math.ceil(liveDriver.etaSeconds / 60))
    : null;
  const fareLabel =
    formatRideFare({
      ngn: liveDriver?.lockedFareNgn ?? currentRide?.fareEstimateNgn,
    }) ?? "Fare pending";
  const vehicleLine = formatVehicleLine({
    rating: liveDriver?.driverRating,
    vehicleModel: liveDriver?.vehicleModel,
  });
  const driverName = liveDriver?.driverName ?? "Driver assigned";
  const driverInitials = driverName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const mapHeight = Math.min(232, Math.max(168, Math.floor(height * 0.28)));
  const destination = itinerary.stops[itinerary.stops.length - 1];

  function handleCancelRide() {
    clearRide();
    router.replace("/rider");
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <RevealView style={styles.mapWrap}>
        <LiveMap
          height={mapHeight}
          pickup={currentRide?.route?.pickup}
          destination={currentRide?.route?.destination}
          stops={currentRide?.route?.stops}
          route={currentRide?.route?.route}
          driverLocation={currentRide?.driverLocation}
          initialCenter={currentRide?.route?.pickup}
          fitPadding={{ top: 52, right: 32, bottom: 52, left: 32 }}
        >
          <FloatingView style={styles.backButton} distance={5}>
            <BackArrow onPress={() => router.back()} />
          </FloatingView>
          <FloatingView style={styles.etaChip} distance={6}>
            <AppText variant="monoSmall">
              ETA: {etaMinutes !== null ? `${etaMinutes} min` : "pending"}
            </AppText>
          </FloatingView>
        </LiveMap>
      </RevealView>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <RevealView delay={120} style={styles.contentInner}>
          <View style={styles.headerRow}>
            <AppBadge label="DRIVER MATCHED" />
            <View style={styles.etaBadge}>
              <AppText variant="monoSmall" color={theme.colors.black}>
                {etaMinutes !== null ? `${etaMinutes} MIN AWAY` : "ETA PENDING"}
              </AppText>
            </View>
          </View>

          <AppText variant="h2" style={styles.arrivalTitle}>
            {etaMinutes !== null
              ? `Your driver is arriving in ${etaMinutes} min`
              : "Your driver is on the way"}
          </AppText>

          <View style={styles.driverCard}>
            <PulseView>
              <View style={styles.avatar}>
                <AppText variant="h3" color={theme.colors.white}>
                  {driverInitials || "DR"}
                </AppText>
              </View>
            </PulseView>
            <View style={styles.driverText}>
              <AppText variant="h3" numberOfLines={1}>
                {driverName}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={2}>
                {vehicleLine}
              </AppText>
              <View style={styles.driverMetaRow}>
                <View style={styles.plate}>
                  <AppText variant="monoSmall" color={theme.colors.offWhite} numberOfLines={1}>
                    {liveDriver?.vehiclePlate ?? "PLATE PENDING"}
                  </AppText>
                </View>
                <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
                  {fareLabel}
                </AppText>
              </View>
            </View>
          </View>

          <AppCard style={styles.pickupCard}>
            <View style={styles.pickupDot} />
            <View style={styles.pickupCopy}>
              <AppText variant="monoSmall" color={theme.colors.muted}>
                PICKUP
              </AppText>
              <AppText variant="bodyMedium" numberOfLines={2}>
                {itinerary.pickup}
              </AppText>
            </View>
          </AppCard>

          {destination ? (
            <AppCard style={styles.pickupCard}>
              <View style={[styles.pickupDot, styles.destDot]} />
              <View style={styles.pickupCopy}>
                <AppText variant="monoSmall" color={theme.colors.muted}>
                  DESTINATION
                </AppText>
                <AppText variant="bodyMedium" numberOfLines={2}>
                  {destination}
                </AppText>
              </View>
            </AppCard>
          ) : null}

          <View style={styles.actions}>
            <View style={styles.secondaryActions}>
              <AppButton
                title="Call driver"
                variant="inverse"
                style={styles.secondaryButton}
              />
              <AppButton
                title="Cancel ride"
                variant="danger"
                onPress={handleCancelRide}
                style={[styles.secondaryButton, styles.cancelButton]}
              />
            </View>
          </View>
        </RevealView>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
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
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  contentInner: {
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  etaBadge: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
  },
  arrivalTitle: {
    marginTop: theme.spacing.xs,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    ...theme.shadows.card,
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
    minWidth: 0,
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
  driverMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  pickupCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    marginTop: 3,
  },
  destDot: {
    backgroundColor: theme.colors.black,
  },
  pickupCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 120,
    backgroundColor: theme.colors.white,
  },
  cancelButton: {
    backgroundColor: theme.colors.dangerLight,
  },
});
