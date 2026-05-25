import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
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
import { createIdempotencyKey } from "@/lib/idempotency";
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
type RideTier = "basic" | "premium";

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

function formatCompactNgn(value: number): string {
  return Math.round(value).toLocaleString("en-NG");
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

function CarArtwork({
  accentColor,
  highlightColor,
}: {
  accentColor: string;
  highlightColor: string;
}) {
  return (
    <View style={styles.vehicleArtwork}>
      <View style={styles.evWrap}>
        <View style={[styles.evBody, { backgroundColor: accentColor }]}>
          <View style={styles.evCabin} />
          <View style={styles.evWindow} />
          <View style={[styles.evBolt, { backgroundColor: theme.colors.white }]} />
          <View style={[styles.evLight, styles.evHeadlight]} />
          <View style={[styles.evLight, styles.evTaillight]} />
        </View>
        <View style={[styles.evWheel, styles.evWheelLeft]}>
          <View style={styles.evWheelHub} />
        </View>
        <View style={[styles.evWheel, styles.evWheelRight]}>
          <View style={styles.evWheelHub} />
        </View>
      </View>
      <View style={[styles.rideTierBadge, { backgroundColor: highlightColor }]}>
        <AppText variant="monoSmall">{accentColor === theme.colors.orange ? "B" : "P"}</AppText>
      </View>
    </View>
  );
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
  const [selectedRideTier, setSelectedRideTier] = useState<RideTier>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scheduledRideIdempotencyKeyRef = useRef<string | null>(null);
  const collapsedSheetOffset = 320;
  const sheetOffset = useSharedValue(0);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const scheduledAt = useMemo(
    () => parseScheduledAtParam(params.scheduledAt),
    [params.scheduledAt],
  );

  useEffect(() => {
    setLiveEstimate(initialEstimate ?? fallbackEstimate);
  }, [fallbackEstimate, initialEstimate]);

  const SHEET_MIN_HEIGHT = 300;
  const routeFitPadding = {
    top: 88,
    right: 56,
    bottom: SHEET_MIN_HEIGHT + 44,
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
  const baseFareNgn =
    liveEstimateFareNgn !== null ? liveEstimateFareNgn : instantPreview.priceNgn;
  const rideOptions = useMemo(
    () => [
      {
        id: "basic" as const,
        label: "Basic",
        subtitle: scheduledAt
          ? "Reliable everyday ride for your scheduled trip"
          : "Affordable everyday ride for this route",
        accentColor: theme.colors.orange,
        badgeColor: "#FFD7BF",
        etaMinutes: resolvedEstimate
          ? Math.max(1, Math.ceil(resolvedEstimate.plannedDurationSeconds / 60))
          : instantPreview.etaMinutes,
        fareNgn: baseFareNgn,
      },
      {
        id: "premium" as const,
        label: "Premium",
        subtitle: scheduledAt
          ? "Polished ride with a more premium feel"
          : "Extra-comfort option with a cleaner premium feel",
        accentColor: "#1F2948",
        badgeColor: "#DDE7FF",
        etaMinutes: resolvedEstimate
          ? Math.max(1, Math.ceil(resolvedEstimate.plannedDurationSeconds / 60) - 1)
          : Math.max(1, instantPreview.etaMinutes - 1),
        fareNgn: Math.round(baseFareNgn * 1.24),
      },
    ],
    [baseFareNgn, instantPreview.etaMinutes, resolvedEstimate, scheduledAt],
  );
  const selectedRideOption =
    rideOptions.find((option) => option.id === selectedRideTier) ?? rideOptions[0];
  const displayEtaLabel = `${selectedRideOption.etaMinutes} min trip`;
  const displayDistanceLabel = resolvedEstimate
    ? `${resolvedEstimate.plannedDistanceKm.toFixed(1)} km route`
    : instantPreview.distanceLabel;
  const displayFareLabel = formatNgn(selectedRideOption.fareNgn);
  const scheduleSummary = scheduledAt ? formatScheduledAt(scheduledAt) : null;
  const routeNote = scheduledAt
    ? `This route will be scheduled for ${scheduleSummary ?? "your selected time"}.`
    : resolvedEstimate
      ? `${selectedRideOption.label} live estimate for this route.`
      : `${selectedRideOption.label} preview. Final live quote will refresh automatically.`;
  const canBookRide = !isSubmitting;

  useEffect(() => {
    scheduledRideIdempotencyKeyRef.current = null;
  }, [scheduledAt, serializedItinerary]);

  const handleEditRoute = () => {
    router.push({
      pathname: "/destination-search",
      params: {
        itinerary: serializedItinerary,
      },
    });
  };

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
          idempotencyKey:
            scheduledRideIdempotencyKeyRef.current ??
            (scheduledRideIdempotencyKeyRef.current = createIdempotencyKey(
              "scheduled-ride",
            )),
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

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetScrollContent}
        >
          <View style={styles.sheetHeader}>
            <View>
              <AppText variant="monoSmall" color={theme.colors.orange}>
                {scheduledAt ? "SCHEDULED RIDE" : "RIDE OPTION"}
              </AppText>
              <AppText variant="h1">Wheeler</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {scheduledAt
                  ? "Choose the ride feel you want for this scheduled trip."
                  : "Pick the ride style that fits this route best."}
              </AppText>
            </View>
            <View style={styles.rideIcon}>
              <CarArtwork
                accentColor={selectedRideOption.accentColor}
                highlightColor={selectedRideOption.badgeColor}
              />
            </View>
          </View>

          <View style={styles.rideOptionsList}>
            {rideOptions.map((option) => {
              const selected = option.id === selectedRideTier;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedRideTier(option.id)}
                  style={[
                    styles.rideOptionCard,
                    selected ? styles.rideOptionCardSelected : null,
                  ]}
                >
                  <View style={styles.rideOptionLeft}>
                    <View
                      style={[
                        styles.rideOptionIconShell,
                        selected ? styles.rideOptionIconShellSelected : null,
                      ]}
                    >
                      <CarArtwork
                        accentColor={option.accentColor}
                        highlightColor={option.badgeColor}
                      />
                    </View>
                    <View style={styles.rideOptionCopy}>
                      <View style={styles.rideOptionTitleRow}>
                        <AppText variant="h3">{option.label}</AppText>
                        {selected ? (
                          <View style={styles.selectedBadge}>
                            <AppText
                              variant="monoSmall"
                              color={theme.colors.offWhite}
                            >
                              Selected
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        {option.subtitle}
                      </AppText>
                      <View style={styles.metricRow}>
                        <MetricPill label={`${option.etaMinutes} min`} />
                        <MetricPill label={displayDistanceLabel} muted />
                      </View>
                    </View>
                  </View>
                  <View style={styles.rideOptionPrice}>
                    <AppText variant="monoSmall" color={theme.colors.muted}>
                      NGN
                    </AppText>
                    <AppText variant="h3">
                      {formatCompactNgn(option.fareNgn)}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.routeBox}>
            <View style={styles.routeBoxHeader}>
              <AppText variant="monoSmall" color={theme.colors.muted}>
                ROUTE
              </AppText>
              <Pressable onPress={handleEditRoute} style={styles.editRouteButton}>
                <AppText variant="monoSmall" color={theme.colors.orange}>
                  Edit route
                </AppText>
              </Pressable>
            </View>
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
                  ? `Scheduling ${selectedRideOption.label}...`
                  : `Schedule ${selectedRideOption.label}`
                : `Book ${selectedRideOption.label}`
            }
            onPress={handleBookRide}
            disabled={!canBookRide}
          />
        </ScrollView>
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
    bottom: 264,
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    minHeight: 300,
  },
  sheetScrollContent: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: 4,
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
    width: 64,
    height: 54,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  rideOptionsList: {
    gap: theme.spacing.xs,
  },
  rideOptionCard: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  rideOptionCardSelected: {
    backgroundColor: "#FFF7F1",
    borderColor: theme.colors.orange,
  },
  rideOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  rideOptionIconShell: {
    width: 72,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.offWhite,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.borderLight,
  },
  rideOptionIconShellSelected: {
    backgroundColor: "#FFF0E4",
    borderColor: theme.colors.orange,
  },
  rideOptionCopy: {
    flex: 1,
    gap: 4,
  },
  rideOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  selectedBadge: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  metricPill: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metricPillAccent: {
    backgroundColor: "#FFD1B5",
  },
  metricPillMuted: {
    backgroundColor: theme.colors.white,
  },
  rideOptionPrice: {
    minWidth: 76,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  routeBox: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    ...theme.shadows.card,
  },
  routeBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editRouteButton: {
    paddingVertical: 4,
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
    marginVertical: theme.spacing.xs,
  },
  vehicleArtwork: {
    position: "relative",
    width: 52,
    height: 36,
  },
  rideTierBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  evWrap: {
    position: "relative",
    width: 52,
    height: 34,
    marginTop: 2,
  },
  evBody: {
    position: "absolute",
    left: 5,
    right: 4,
    bottom: 7,
    height: 18,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: 10,
  },
  evCabin: {
    position: "absolute",
    left: 10,
    top: -9,
    width: 21,
    height: 11,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 8,
    backgroundColor: theme.colors.white,
  },
  evWindow: {
    position: "absolute",
    left: 14,
    top: -6,
    width: 14,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#D9F3FF",
    borderWidth: 1.5,
    borderColor: theme.colors.black,
  },
  evBolt: {
    position: "absolute",
    top: 4,
    left: 23,
    width: 5,
    height: 8,
    transform: [{ skewX: "-18deg" }],
    borderRadius: 1,
  },
  evLight: {
    position: "absolute",
    top: 5,
    width: 4,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.black,
  },
  evHeadlight: {
    right: 2,
    backgroundColor: "#FFF4CC",
  },
  evTaillight: {
    left: 2,
    backgroundColor: "#FFC4C4",
  },
  evWheel: {
    position: "absolute",
    bottom: 0,
    width: 12,
    height: 12,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  evWheelLeft: {
    left: 10,
  },
  evWheelRight: {
    right: 7,
  },
  evWheelHub: {
    width: 4,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
});
