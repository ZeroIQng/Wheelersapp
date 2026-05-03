import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { FloatingView } from "@/components/motion";
import { PulseCircle, StaticMap } from "@/components/static-map";
import { driver } from "@/data/mock";
import { parseRideItineraryParam, serializeRideItinerary } from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

const searchStages = [
  {
    id: "requesting",
    title: "Preparing route",
    subtitle: "Resolving your pickup, destination, and stops for the live request",
  },
  {
    id: "ringing",
    title: "Finding nearby drivers",
    subtitle: "Wheelers is sending the trip to the best drivers around your route",
  },
  {
    id: "matching",
    title: "Waiting for acceptance",
    subtitle: "A nearby driver is reviewing the route details now",
  },
] as const;

function isTerminalStatus(status: string | undefined): boolean {
  return status === "completed" || status === "cancelled";
}

function formatUsdt(value: number | undefined, fallback: string): string {
  return typeof value === "number" ? `${value.toFixed(2)} USDT` : fallback;
}

function describeIssue(
  explicitError: string | null,
  cancelReason: string | undefined,
): string | null {
  if (explicitError) {
    return explicitError;
  }

  if (!cancelReason) {
    return null;
  }

  if (cancelReason === "no_drivers_available") {
    return "No drivers are available around this route right now.";
  }

  return cancelReason.replace(/_/g, " ");
}

export default function MatchingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
  }>();
  const itinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const serializedItinerary = useMemo(
    () => serializeRideItinerary(itinerary),
    [itinerary],
  );
  const { cancelRide, clearRide, currentRide, error, requestRide } = useRideSession();
  const [stageIndex, setStageIndex] = useState(0);
  const requestKeyRef = useRef<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const liveRideKey = currentRide
    ? serializeRideItinerary(currentRide.itinerary)
    : null;

  useEffect(() => {
    if (
      currentRide &&
      !isTerminalStatus(currentRide.status) &&
      liveRideKey === serializedItinerary
    ) {
      return;
    }

    if (
      currentRide &&
      !isTerminalStatus(currentRide.status) &&
      liveRideKey &&
      liveRideKey !== serializedItinerary
    ) {
      return;
    }

    if (requestKeyRef.current === serializedItinerary) {
      return;
    }

    requestKeyRef.current = serializedItinerary;
    void requestRide(itinerary).catch(() => undefined);
  }, [currentRide, itinerary, liveRideKey, requestRide, serializedItinerary]);

  useEffect(() => {
    const nextStatus = currentRide?.status ?? null;
    if (!nextStatus || previousStatusRef.current === nextStatus) {
      return;
    }

    previousStatusRef.current = nextStatus;

    if (nextStatus === "matched" || nextStatus === "active") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (nextStatus === "cancelled") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [currentRide?.status]);

  useEffect(() => {
    if (currentRide?.status === "matched") {
      router.replace({
        pathname: "/driver-found",
        params: { itinerary: serializedItinerary },
      });
      return;
    }

    if (currentRide?.status === "active") {
      router.replace({
        pathname: "/rider/active-trip",
        params: { itinerary: serializedItinerary },
      });
    }
  }, [currentRide?.status, router, serializedItinerary]);

  useEffect(() => {
    if (
      currentRide?.status !== "requesting" &&
      currentRide?.status !== "matching"
    ) {
      return;
    }

    const timer = setInterval(() => {
      setStageIndex((current) => (current + 1) % searchStages.length);
      void Haptics.selectionAsync();
    }, 1200);

    return () => clearInterval(timer);
  }, [currentRide?.status]);

  const issue = describeIssue(error, currentRide?.cancelReason);
  const activeStage = searchStages[Math.min(stageIndex, searchStages.length - 1)];
  const matchedDriver = currentRide?.driver;
  const nearbyDriversLabel = useMemo(() => {
    if (issue) {
      return "Request update";
    }

    if (currentRide?.status === "matched") {
      return "Driver found";
    }

    if (currentRide?.status === "active") {
      return "Trip started";
    }

    if (currentRide?.status === "requesting") {
      return "Resolving route";
    }

    if (currentRide?.status === "matching") {
      return "Searching nearby";
    }

    return "Live request";
  }, [currentRide?.status, issue]);

  async function handleCancelRide() {
    try {
      await cancelRide("rider_cancelled");
    } finally {
      router.replace("/rider");
    }
  }

  async function handleRetryRequest() {
    requestKeyRef.current = null;
    clearRide();
    try {
      await requestRide(itinerary);
    } catch {
      // Provider error state is enough for the UI.
    }
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      <View style={styles.mapWrap}>
        <StaticMap height={780} scene="driverFound">
          {!issue ? <MapSearchPulse /> : null}

          <View style={styles.mapTopRow}>
            <BackArrow onPress={() => router.back()} />
            <FloatingView distance={5}>
              <View style={styles.mapChip}>
                <MaterialIcons
                  name={
                    currentRide?.status === "matched" || currentRide?.status === "active"
                      ? "local-taxi"
                      : "location-on"
                  }
                  size={16}
                  color={theme.colors.black}
                />
                <AppText variant="monoSmall">{nearbyDriversLabel}</AppText>
              </View>
            </FloatingView>
          </View>

          <FloatingView style={styles.mapBadge} distance={6}>
            <View style={styles.mapBadgeInner}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {issue
                  ? "Ride request paused"
                  : currentRide?.status === "matched"
                    ? "Driver matched"
                    : currentRide?.status === "active"
                      ? "Trip started"
                      : "Searching nearby"}
              </AppText>
              <AppText variant="monoLarge">
                {matchedDriver?.etaSeconds
                  ? `${Math.max(1, Math.ceil(matchedDriver.etaSeconds / 60))} min away`
                  : "Live request"}
              </AppText>
            </View>
          </FloatingView>
        </StaticMap>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        {issue ? (
          <>
            <View style={styles.errorHeader}>
              <View style={styles.searchIconWrap}>
                <MaterialIcons
                  name="error-outline"
                  size={24}
                  color={theme.colors.offWhite}
                />
              </View>
              <View style={styles.searchCopy}>
                <AppText variant="monoSmall" color={theme.colors.danger}>
                  RIDE REQUEST
                </AppText>
                <AppText variant="h2">Couldn&apos;t finish matching</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {issue}
                </AppText>
              </View>
            </View>

            <View style={styles.searchInfoCard}>
              <View style={styles.searchInfoRow}>
                <MaterialIcons
                  name="route"
                  size={18}
                  color={theme.colors.orange}
                />
                <AppText variant="bodyMedium">
                  {itinerary.pickup} to {itinerary.stops[itinerary.stops.length - 1]}
                </AppText>
              </View>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Retry the same route or go back and change your stops before sending another live request.
              </AppText>
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionSlot}>
                <CompactActionButton title="Retry request" onPress={handleRetryRequest} />
              </View>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Back home"
                  variant="ghost"
                  onPress={() => router.replace("/rider")}
                />
              </View>
            </View>
          </>
        ) : matchedDriver ? (
          <>
            <AppText variant="monoSmall" color={theme.colors.green}>
              DRIVER FOUND
            </AppText>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/driver-found",
                  params: { itinerary: serializedItinerary },
                })
              }
              style={styles.driverFoundCard}
            >
              <View style={styles.driverFoundTop}>
                <View style={styles.carIconWrap}>
                  <MaterialIcons
                    name="local-taxi"
                    size={26}
                    color={theme.colors.offWhite}
                  />
                </View>
                <View style={styles.driverFoundCopy}>
                  <AppText variant="h2">Driver found</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {matchedDriver.driverName ?? driver.name} • {" "}
                    {matchedDriver.vehicleModel ?? driver.vehicle}
                  </AppText>
                </View>
                <MaterialIcons
                  name="keyboard-arrow-right"
                  size={24}
                  color={theme.colors.black}
                />
              </View>

              <View style={styles.driverMetaRow}>
                <MetaPill
                  label={`ETA ${Math.max(1, Math.ceil((matchedDriver.etaSeconds ?? 120) / 60))} min`}
                />
                <MetaPill label={matchedDriver.vehiclePlate ?? driver.plate} />
                <MetaPill
                  label={formatUsdt(matchedDriver.lockedFareUsdt, driver.fare)}
                />
              </View>

              <AppText variant="bodySmall" color={theme.colors.muted}>
                Open the live driver card to track the route and rider-side trip details.
              </AppText>
            </Pressable>

            <View style={styles.actionsRow}>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="View ride"
                  onPress={() =>
                    router.push({
                      pathname: "/driver-found",
                      params: { itinerary: serializedItinerary },
                    })
                  }
                />
              </View>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Cancel ride"
                  variant="danger"
                  onPress={handleCancelRide}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.searchHeader}>
              <View style={styles.searchIconWrap}>
                <MaterialIcons
                  name="location-searching"
                  size={24}
                  color={theme.colors.offWhite}
                />
              </View>
              <View style={styles.searchCopy}>
                <AppText variant="monoSmall" color={theme.colors.orange}>
                  FINDING DRIVER
                </AppText>
                <AppText variant="h2">{activeStage.title}</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {activeStage.subtitle}
                </AppText>
              </View>
            </View>

            <View style={styles.progressRow}>
              {searchStages.map((stage, index) => (
                <View
                  key={stage.id}
                  style={[
                    styles.progressDot,
                    index < stageIndex ? styles.progressDotDone : null,
                    index === stageIndex ? styles.progressDotActive : null,
                  ]}
                />
              ))}
            </View>

            <View style={styles.searchInfoCard}>
              <View style={styles.searchInfoRow}>
                <MaterialIcons
                  name="notifications-active"
                  size={18}
                  color={theme.colors.orange}
                />
                <AppText variant="bodyMedium">Ride request is live</AppText>
              </View>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Wheelers is matching your rider route from {itinerary.pickup} to {" "}
                {itinerary.stops[itinerary.stops.length - 1]}.
              </AppText>
              {currentRide?.fareEstimateUsdt ? (
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Current backend fare estimate: {formatUsdt(currentRide.fareEstimateUsdt, driver.fare)}
                </AppText>
              ) : null}
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Edit route"
                  variant="ghost"
                  onPress={() => router.back()}
                />
              </View>
              <View style={styles.actionSlot}>
                <CompactActionButton
                  title="Cancel ride"
                  variant="danger"
                  onPress={handleCancelRide}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </AppScreen>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <AppText variant="monoSmall">{label}</AppText>
    </View>
  );
}

function CompactActionButton({
  title,
  onPress,
  variant = "primary",
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger";
}) {
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactButton,
        isGhost ? styles.compactButtonGhost : null,
        isDanger ? styles.compactButtonDanger : null,
        pressed ? styles.compactButtonActive : null,
      ]}
    >
      <AppText
        numberOfLines={1}
        style={[
          styles.compactButtonLabel,
          isDanger
            ? styles.compactButtonLabelDanger
            : isGhost
              ? styles.compactButtonLabelGhost
              : styles.compactButtonLabelPrimary,
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

function MapSearchPulse() {
  const overlayOpacity = useSharedValue(0.08);
  const markerScale = useSharedValue(1);

  useEffect(() => {
    overlayOpacity.value = withRepeat(
      withSequence(
        withTiming(0.16, { duration: 650 }),
        withTiming(0.06, { duration: 650 }),
      ),
      -1,
      false,
    );

    markerScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [markerScale, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markerScale.value }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.mapBreath, overlayStyle]}
      />
      <View pointerEvents="none" style={styles.mapSignalWrap}>
        <PulseCircle
          size={140}
          color={theme.colors.orange}
          style={styles.mapSignalOuter}
        />
        <PulseCircle
          size={92}
          color={theme.colors.orange}
          delay={260}
          style={styles.mapSignalInner}
        />
        <Animated.View style={[styles.mapSignalMarker, markerStyle]}>
          <MaterialIcons
            name="location-on"
            size={28}
            color={theme.colors.offWhite}
          />
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  mapWrap: {
    flex: 1,
  },
  mapBreath: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.orange,
  },
  mapSignalWrap: {
    position: "absolute",
    top: "35%",
    left: "50%",
    width: 140,
    height: 140,
    marginLeft: -70,
    marginTop: -70,
    alignItems: "center",
    justifyContent: "center",
  },
  mapSignalOuter: {
    top: 0,
    left: 0,
  },
  mapSignalInner: {
    top: 24,
    left: 24,
  },
  mapSignalMarker: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  mapTopRow: {
    position: "absolute",
    top: 16,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  mapBadge: {
    position: "absolute",
    right: theme.spacing.gutter,
    bottom: 308,
  },
  mapBadgeInner: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 2,
    ...theme.shadows.card,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    minHeight: 320,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 56,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.mutedLight,
    marginBottom: theme.spacing.xs,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  searchIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  searchCopy: {
    flex: 1,
    gap: 2,
  },
  progressRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  progressDot: {
    flex: 1,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: "#E4D7CB",
  },
  progressDotDone: {
    backgroundColor: theme.colors.orangeLight,
  },
  progressDotActive: {
    backgroundColor: theme.colors.orange,
  },
  searchInfoCard: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  searchInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  actionSlot: {
    flex: 1,
  },
  compactButton: {
    minHeight: 48,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.card,
  },
  compactButtonGhost: {
    backgroundColor: theme.colors.white,
  },
  compactButtonDanger: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.offWhite,
  },
  compactButtonActive: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  compactButtonLabel: {
    textAlign: "center",
  },
  compactButtonLabelPrimary: {
    color: theme.colors.offWhite,
  },
  compactButtonLabelGhost: {
    color: theme.colors.black,
  },
  compactButtonLabelDanger: {
    color: theme.colors.danger,
  },
  driverFoundCard: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  driverFoundTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  carIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  driverFoundCopy: {
    flex: 1,
    gap: 2,
  },
  driverMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  metaPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
  },
});
