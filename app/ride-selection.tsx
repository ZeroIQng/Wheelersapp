import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { LiveMap } from "@/components/live-map";
import { FloatingView } from "@/components/motion";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { getRideEstimate, isBackendConfigured, type RideEstimateResponse } from "@/lib/api";
import { resolvePlaceQuery } from "@/lib/osm-places";
import { parseRideEstimateParam, serializeRideEstimate } from "@/lib/ride-estimate";
import {
  getRideRouteRows,
  parseRideItineraryParam,
  serializeRideItinerary,
} from "@/lib/ride-route";
import { theme } from "@/theme";

const { height } = Dimensions.get("window");

function getLiveEstimateFareNgn(
  estimate: RideEstimateResponse,
): number | null {
  if (typeof estimate.fareEstimateNgn === "number" && Number.isFinite(estimate.fareEstimateNgn)) {
    return estimate.fareEstimateNgn;
  }

  return null;
}

function formatNgn(value: number): string {
  return `NGN ${Math.round(value).toLocaleString("en-NG")}`;
}

export default function RideSelectionScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = usePrivy();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
    estimate?: string | string[];
  }>();
  const itinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const initialEstimate = useMemo(
    () => parseRideEstimateParam(params.estimate),
    [params.estimate],
  );
  const routeRows = useMemo(() => getRideRouteRows(itinerary), [itinerary]);
  const [liveEstimate, setLiveEstimate] = useState<RideEstimateResponse | null>(
    initialEstimate,
  );
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const collapsedSheetOffset = 196;
  const sheetOffset = useSharedValue(0);
  const serializedItinerary = serializeRideItinerary(itinerary);

  useEffect(() => {
    setLiveEstimate(initialEstimate);
  }, [initialEstimate]);

  const SHEET_MIN_HEIGHT = 470;
  const routeFitPadding = {
    top: 88,
    right: 56,
    bottom: SHEET_MIN_HEIGHT + 56,
    left: 56,
  };

  const expandSheet = () => {
    sheetOffset.value = withTiming(0, { duration: 220 });
  };

  const collapseSheet = () => {
    sheetOffset.value = withTiming(collapsedSheetOffset, { duration: 220 });
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          expandSheet();
          return;
        }
        if (gestureState.dy > 30) {
          collapseSheet();
        }
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (gestureState.dy < -30) {
          expandSheet();
          return;
        }
        if (gestureState.dy > 30) {
          collapseSheet();
        }
      },
    }),
  ).current;

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }));

  useEffect(() => {
    let cancelled = false;

    async function loadEstimate(): Promise<void> {
      if (!isBackendConfigured() || !isReady || !user) {
        if (!cancelled) {
          setLiveEstimate(null);
        }
        return;
      }

      const destinationLabel = itinerary.stops[itinerary.stops.length - 1];
      if (!destinationLabel) {
        if (!cancelled) {
          setLiveEstimate(null);
        }
        return;
      }

      setEstimateError(null);

      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          throw new Error("Could not get an access token for ride estimate.");
        }

        const [pickup, destination, ...stops] = await Promise.all([
          resolvePlaceQuery(itinerary.pickup),
          resolvePlaceQuery(destinationLabel),
          ...itinerary.stops.slice(0, -1).map((stop) => resolvePlaceQuery(stop)),
        ]);

        const response = await getRideEstimate({
          accessToken,
          pickup,
          destination,
          stops,
        });

        if (!cancelled) {
          setLiveEstimate(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setLiveEstimate(null);
          setEstimateError(
            loadError instanceof Error
              ? loadError.message
              : "Could not calculate the live route estimate.",
          );
        }
      } finally {
        // no-op
      }
    }

    void loadEstimate();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isReady, itinerary, user]);

  const liveEstimateFareNgn = liveEstimate ? getLiveEstimateFareNgn(liveEstimate) : null;
  const displayEtaLabel = liveEstimate
    ? `${Math.max(1, Math.ceil(liveEstimate.plannedDurationSeconds / 60))} min trip`
    : estimateError
      ? "Route unavailable"
      : "Calculating route";
  const displayDistanceLabel = liveEstimate
    ? `${liveEstimate.plannedDistanceKm.toFixed(1)} km route`
    : estimateError
      ? "Distance unavailable"
      : "Waiting for route";
  const displayFareLabel =
    liveEstimateFareNgn !== null ? formatNgn(liveEstimateFareNgn) : "Fare pending";
  const routeNote = liveEstimate
    ? "Live backend estimate for this route."
    : estimateError ?? "Requesting a live route estimate from the backend.";
  const canBookRide = Boolean(liveEstimate);

  const handleBookRide = () => {
    if (!liveEstimate) {
      return;
    }

    router.push({
      pathname: "/matching",
      params: {
        itinerary: serializedItinerary,
        estimate: serializeRideEstimate(liveEstimate),
      },
    });
  };

  return (
    <AppScreen
      backgroundColor={theme.colors.mapBase}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.mapBase} />

      <View style={styles.mapWrap}>
        <LiveMap
          height={height}
          pickup={liveEstimate?.pickup}
          destination={liveEstimate?.destination}
          stops={liveEstimate?.stops}
          route={liveEstimate?.route}
          initialCenter={liveEstimate?.pickup}
          fitPadding={routeFitPadding}
        >
          <View style={styles.topBar}>
            <BackArrow onPress={() => router.back()} />
            <FloatingView distance={5}>
              <View style={styles.mapChip}>
                <AppText variant="monoSmall">
                  Wheeler • {displayEtaLabel}
                </AppText>
              </View>
            </FloatingView>
          </View>

          <FloatingView style={styles.priceBadge} distance={6}>
            <View style={styles.priceBadgeInner}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {liveEstimate ? "Backend fare preview" : "Estimated fare"}
              </AppText>
              <AppText variant="monoLarge">{displayFareLabel}</AppText>
            </View>
          </FloatingView>
        </LiveMap>
      </View>

      <Animated.View
        style={[styles.sheet, sheetAnimatedStyle]}
        {...sheetPanResponder.panHandlers}
      >
        <Pressable onPress={expandSheet} style={styles.handleArea}>
          <View style={styles.handle} />
        </Pressable>

        <View style={styles.sheetHeader}>
          <View>
            <AppText variant="monoSmall" color={theme.colors.orange}>
              RIDE OPTION
            </AppText>
            <AppText variant="h1">Wheeler</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Fast bike ride with multi-stop routing
            </AppText>
          </View>
          <View style={styles.rideIcon}>
            <AppText style={styles.rideEmoji}>🛵</AppText>
          </View>
        </View>

        <Pressable onPress={expandSheet} style={styles.rideCard}>
          <View style={styles.rideCardMain}>
            <View style={styles.rideCopy}>
              <View style={styles.metricRow}>
                <MetricPill label={displayEtaLabel} />
                <MetricPill label={displayDistanceLabel} muted />
              </View>
              <AppText variant="h3">Wheeler</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {routeNote}
              </AppText>
              {estimateError && !liveEstimate ? (
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {estimateError}
                </AppText>
              ) : null}
            </View>
            <View style={styles.priceBlock}>
              <AppText variant="monoSmall" color={theme.colors.offWhite}>
                NGN
              </AppText>
              <AppText variant="h2" color={theme.colors.offWhite}>
                {liveEstimateFareNgn !== null
                  ? Math.round(liveEstimateFareNgn).toLocaleString("en-NG")
                  : "--"}
              </AppText>
            </View>
          </View>
        </Pressable>

        <View style={styles.routeBox}>
          {routeRows.map((row, index) => (
            <View key={row.id}>
              <RouteRow
                kind={row.kind}
                label={row.label}
                value={row.value}
              />
              {index < routeRows.length - 1 ? (
                <View style={styles.routeDivider} />
              ) : null}
            </View>
          ))}
        </View>

        <AppButton
          title={liveEstimate ? "Book Wheeler" : "Waiting for live estimate"}
          onPress={handleBookRide}
          disabled={!canBookRide}
        />
      </Animated.View>
    </AppScreen>
  );
}

function MetricPill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View
      style={[
        styles.metricPill,
        muted ? styles.metricPillMuted : styles.metricPillAccent,
      ]}
    >
      <AppText variant="monoSmall" color={theme.colors.black}>
        {label}
      </AppText>
    </View>
  );
}

function RouteRow({
  kind,
  label,
  value,
}: {
  kind: "pickup" | "stop" | "destination";
  label: string;
  value: string;
}) {
  return (
    <View style={styles.routeRow}>
      <View
        style={[
          styles.routeDot,
          kind === "pickup"
            ? styles.routeDotPickup
            : kind === "destination"
              ? styles.routeDotDestination
              : styles.routeDotStop,
        ]}
      />
      <View style={styles.routeCopy}>
        <AppText variant="monoSmall" color={theme.colors.muted}>
          {label}
        </AppText>
        <AppText variant="bodyMedium">{value}</AppText>
      </View>
    </View>
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
  topBar: {
    position: "absolute",
    top: 16,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapChip: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  priceBadge: {
    position: "absolute",
    right: theme.spacing.gutter,
    bottom: 306,
  },
  priceBadgeInner: {
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
    minHeight: 470,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.mutedLight,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rideIcon: {
    width: 62,
    height: 62,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  rideEmoji: {
    fontSize: 28,
  },
  rideCard: {
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  rideCardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  rideCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  metricRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  metricPill: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
  },
  metricPillAccent: {
    backgroundColor: "#FFD1B5",
  },
  metricPillMuted: {
    backgroundColor: theme.colors.white,
  },
  priceBlock: {
    minWidth: 118,
    alignSelf: "stretch",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(13,13,13,0.18)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  routeBox: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  routeDot: {
    width: 14,
    height: 14,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  routeDotPickup: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.green,
  },
  routeDotStop: {
    borderRadius: 4,
    backgroundColor: "#FFD1B5",
  },
  routeDotDestination: {
    borderRadius: 4,
    backgroundColor: theme.colors.orange,
  },
  routeCopy: {
    flex: 1,
    gap: 1,
  },
  routeDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginLeft: 22,
    marginVertical: theme.spacing.sm,
  },
});
