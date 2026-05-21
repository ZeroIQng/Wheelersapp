import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { resolvePlaceQuery } from "@/lib/google-places";
import {
  buildInstantRideEstimate,
  parseRideEstimateParam,
  serializeRideEstimate,
} from "@/lib/ride-estimate";
import {
  estimateRide,
  getRideRouteRows,
  parseRideItineraryParam,
  serializeRideItinerary,
} from "@/lib/ride-route";
import { submitScheduledRide } from "@/lib/scheduled-rides";
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

function hasResolvedLiveEstimate(
  estimate: RideEstimateResponse | null,
): estimate is RideEstimateResponse &
  Required<Pick<RideEstimateResponse, "pickup" | "destination" | "route">> {
  return Boolean(estimate?.pickup && estimate.destination && estimate.route);
}

function parseScheduledAtParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatScheduledAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "your selected time";
  }

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${dayLabel}, ${timeLabel}`;
}

export default function RideSelectionScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = usePrivy();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
    estimate?: string | string[];
    scheduledAt?: string | string[];
  }>();
  const itinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const initialEstimate = useMemo(
    () => parseRideEstimateParam(params.estimate),
    [params.estimate],
  );
  const instantPreview = useMemo(() => estimateRide(itinerary), [itinerary]);
  const fallbackEstimate = useMemo(
    () => buildInstantRideEstimate(itinerary),
    [itinerary],
  );
  const routeRows = useMemo(() => getRideRouteRows(itinerary), [itinerary]);
  const [liveEstimate, setLiveEstimate] = useState<RideEstimateResponse | null>(
    initialEstimate ?? fallbackEstimate,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const collapsedSheetOffset = 196;
  const sheetOffset = useSharedValue(0);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const scheduledAt = useMemo(
    () => parseScheduledAtParam(params.scheduledAt),
    [params.scheduledAt],
  );

  useEffect(() => {
    setLiveEstimate(initialEstimate ?? fallbackEstimate);
  }, [fallbackEstimate, initialEstimate]);

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
          setLiveEstimate((current) => current ?? fallbackEstimate);
        }
        return;
      }

      const destinationLabel = itinerary.stops[itinerary.stops.length - 1];
      if (!destinationLabel) {
        if (!cancelled) {
          setLiveEstimate((current) => current ?? fallbackEstimate);
        }
        return;
      }

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
        void loadError;
      } finally {
        // no-op
      }
    }

    void loadEstimate();

    return () => {
      cancelled = true;
    };
  }, [fallbackEstimate, getAccessToken, isReady, itinerary, user]);

  const resolvedEstimate = hasResolvedLiveEstimate(liveEstimate) ? liveEstimate : null;
  const liveEstimateFareNgn = liveEstimate ? getLiveEstimateFareNgn(liveEstimate) : null;
  const displayEtaLabel = resolvedEstimate
    ? `${Math.max(1, Math.ceil(resolvedEstimate.plannedDurationSeconds / 60))} min trip`
    : `${instantPreview.etaMinutes} min trip`;
  const displayDistanceLabel = resolvedEstimate
    ? `${resolvedEstimate.plannedDistanceKm.toFixed(1)} km route`
    : instantPreview.distanceLabel;
  const displayFareLabel =
    liveEstimateFareNgn !== null
      ? formatNgn(liveEstimateFareNgn)
      : formatNgn(instantPreview.priceNgn);
  const scheduleSummary = scheduledAt ? formatScheduledAt(scheduledAt) : null;
  const routeNote = scheduledAt
    ? `This route will be scheduled for ${scheduleSummary ?? "your selected time"}.`
    : resolvedEstimate
      ? "Live estimate for this route."
      : "Instant route preview. Final live quote will refresh automatically.";
  const canBookRide = !isSubmitting;

  const handleBookRide = async () => {
    if (scheduledAt) {
      setIsSubmitting(true);

      try {
        if (!isBackendConfigured() || !isReady || !user) {
          throw new Error("Wheelers backend is not configured for scheduled rides.");
        }

        const destinationLabel = itinerary.stops[itinerary.stops.length - 1];
        if (!destinationLabel) {
          throw new Error("Select a destination before scheduling this ride.");
        }

        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          throw new Error("Could not get an access token to schedule this ride.");
        }

        const pickup =
          liveEstimate?.pickup ?? (await resolvePlaceQuery(itinerary.pickup));
        const destination =
          liveEstimate?.destination ?? (await resolvePlaceQuery(destinationLabel));
        const stops =
          liveEstimate?.stops ??
          (await Promise.all(
            itinerary.stops
              .slice(0, -1)
              .map((stop) => resolvePlaceQuery(stop)),
          ));

        await submitScheduledRide({
          getAccessToken: async () => accessToken,
          scheduledFor: scheduledAt,
          pickup,
          destination,
          stops,
        });

        router.replace({
          pathname: "/rider/history",
          params: {
            tab: "scheduled",
            toast: `Ride scheduled for ${scheduleSummary ?? "your selected time"}.`,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not schedule this ride.";
        Alert.alert("Schedule failed", message);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    router.push({
      pathname: "/matching",
      params: {
        itinerary: serializedItinerary,
        estimate: serializeRideEstimate(liveEstimate ?? fallbackEstimate),
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
                {resolvedEstimate ? "Backend fare preview" : "Estimated fare"}
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
              {scheduledAt ? "SCHEDULED RIDE" : "RIDE OPTION"}
            </AppText>
            <AppText variant="h1">Wheeler</AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              {scheduledAt
                ? "Reserve this bike ride ahead of time."
                : "Fast bike ride with multi-stop routing"}
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
              { <AppText variant="h3">Wheeler</AppText> }
              <AppText variant="bodySmall" color={theme.colors.muted}>
              {routeNote}
              </AppText>
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
          title={
            scheduledAt
              ? isSubmitting
                ? "Scheduling Wheeler..."
                : "Schedule Wheeler"
              : "Book Wheeler"
          }
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
